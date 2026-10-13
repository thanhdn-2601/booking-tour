import { promises as fs } from 'fs';
import { join } from 'path';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { PUBLIC_DIR } from '../common/public-dir';
import { isForeignKeyViolation } from '../common/postgres-errors';
import { CreateTourImageDto } from './dto/create-tour-image.dto';
import { UpdateTourImageDto } from './dto/update-tour-image.dto';
import { TourImageListResponse } from './interfaces/tour-image-list-response.interface';
import { TourImageResponse } from './interfaces/tour-image-response.interface';
import { UpdateTourImageResponse } from './interfaces/update-tour-image-response.interface';
import { TourImage } from './tour-image.entity';
import { TOUR_IMAGES_UPLOAD_SUBDIR } from './tour-images.constants';
import { ToursService } from './tours.service';

@Injectable()
export class TourImagesService {
  constructor(
    @InjectRepository(TourImage)
    private readonly tourImagesRepository: Repository<TourImage>,
    private readonly toursService: ToursService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    tourId: number,
    file: Express.Multer.File,
    dto: CreateTourImageDto,
  ): Promise<TourImageResponse> {
    try {
      const tourExists = await this.toursService.exists(tourId);
      if (!tourExists) {
        throw new NotFoundException({
          code: 'TOUR_NOT_FOUND',
          message: this.i18n.t('tours.tour_not_found'),
        });
      }

      const imageUrl = `/${TOUR_IMAGES_UPLOAD_SUBDIR}/${file.filename}`;
      const image = this.tourImagesRepository.create({
        tourId,
        imageUrl,
        sortOrder: dto.sortOrder,
      });
      const saved = await this.tourImagesRepository.save(image);
      return {
        id: saved.id,
        imageUrl: saved.imageUrl,
        sortOrder: saved.sortOrder,
      };
    } catch (error) {
      await this.deleteFileAtPath(file.path);
      // Closes the gap between the exists() check above and the save() —
      // the tour could have been deleted in between.
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException({
          code: 'TOUR_NOT_FOUND',
          message: this.i18n.t('tours.tour_not_found'),
        });
      }
      throw error;
    }
  }

  async findAllForTour(tourId: number): Promise<TourImageListResponse> {
    const tourExists = await this.toursService.exists(tourId);
    if (!tourExists) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: this.i18n.t('tours.tour_not_found'),
      });
    }

    const images = await this.tourImagesRepository.find({
      where: { tourId },
      select: { id: true, imageUrl: true, sortOrder: true },
      order: { sortOrder: 'ASC' },
    });
    return {
      items: images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        sortOrder: image.sortOrder,
      })),
    };
  }

  async update(
    tourId: number,
    imageId: number,
    dto: UpdateTourImageDto,
  ): Promise<UpdateTourImageResponse> {
    const result = await this.tourImagesRepository.update(
      { id: imageId, tourId },
      { sortOrder: dto.sortOrder },
    );
    if (!result.affected) {
      throw new NotFoundException({
        code: 'TOUR_OR_IMAGE_NOT_FOUND',
        message: this.i18n.t('tours.tour_or_image_not_found'),
      });
    }
    return { id: imageId, sortOrder: dto.sortOrder };
  }

  async remove(tourId: number, imageId: number): Promise<void> {
    const image = await this.tourImagesRepository.findOne({
      where: { id: imageId, tourId },
      select: { id: true, imageUrl: true },
    });
    if (!image) {
      throw new NotFoundException({
        code: 'TOUR_OR_IMAGE_NOT_FOUND',
        message: this.i18n.t('tours.tour_or_image_not_found'),
      });
    }

    await this.tourImagesRepository.delete({ id: imageId, tourId });
    await this.deleteFileAtPath(join(PUBLIC_DIR, image.imageUrl));
  }

  private async deleteFileAtPath(path: string): Promise<void> {
    await fs.unlink(path).catch(() => undefined);
  }
}
