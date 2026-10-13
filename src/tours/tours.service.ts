import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import {
  DeleteResult,
  Repository,
  SelectQueryBuilder,
  UpdateResult,
} from 'typeorm';

import { CategoriesService } from '../categories/categories.service';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { isForeignKeyViolation } from '../common/postgres-errors';
import { AdminListToursQueryDto } from './dto/admin-list-tours-query.dto';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { AdminTourDetailResponse } from './interfaces/admin-tour-detail-response.interface';
import { AdminTourListItemResponse } from './interfaces/admin-tour-list-item-response.interface';
import { CreateTourResponse } from './interfaces/create-tour-response.interface';
import { UpdateTourResponse } from './interfaces/update-tour-response.interface';
import { UpdateTourStatusResponse } from './interfaces/update-tour-status-response.interface';
import { TourImage } from './tour-image.entity';
import { TourStatus } from './tour-status.enum';
import { Tour } from './tour.entity';

@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(Tour)
    private readonly toursRepository: Repository<Tour>,
    @InjectRepository(TourImage)
    private readonly tourImagesRepository: Repository<TourImage>,
    private readonly categoriesService: CategoriesService,
    private readonly i18n: I18nService,
  ) {}

  exists(tourId: number): Promise<boolean> {
    return this.toursRepository.exists({ where: { id: tourId } });
  }

  async create(dto: CreateTourDto): Promise<CreateTourResponse> {
    const categoryExists = await this.categoriesService.exists(dto.categoryId);
    if (!categoryExists) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: this.i18n.t('categories.category_not_found'),
      });
    }

    const tour = this.toursRepository.create({
      categoryId: dto.categoryId,
      title: dto.title,
      description: dto.description,
      status: TourStatus.DRAFT,
    });
    let saved: Tour;
    try {
      saved = await this.toursRepository.save(tour);
    } catch (error) {
      // Closes the gap between the exists() check above and this write — the
      // category could have been deleted in between.
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException({
          code: 'CATEGORY_NOT_FOUND',
          message: this.i18n.t('categories.category_not_found'),
        });
      }
      throw error;
    }
    return {
      id: saved.id,
      categoryId: saved.categoryId,
      title: saved.title,
      status: saved.status,
    };
  }

  async findAllForAdmin(
    query: AdminListToursQueryDto,
  ): Promise<PaginatedResponse<AdminTourListItemResponse>> {
    const { search, categoryId, status, page, pageSize } = query;

    const applyFilters = (qb: SelectQueryBuilder<Tour>): void => {
      if (search) {
        qb.andWhere('tour.title ILIKE :search', { search: `%${search}%` });
      }
      if (categoryId) {
        qb.andWhere('tour.categoryId = :categoryId', { categoryId });
      }
      if (status) {
        qb.andWhere('tour.status = :status', { status });
      }
    };

    const countQuery = this.toursRepository.createQueryBuilder('tour');
    applyFilters(countQuery);

    const listQuery = this.toursRepository
      .createQueryBuilder('tour')
      .leftJoin('tour.category', 'category')
      .leftJoin('tour.tourTimes', 'tourTime')
      .select('tour.id', 'id')
      .addSelect('tour.title', 'title')
      .addSelect('category.name', 'categoryName')
      .addSelect('tour.status', 'status')
      .addSelect('COUNT(tourTime.id)', 'timesCount')
      .groupBy('tour.id')
      .addGroupBy('category.name')
      .orderBy('tour.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    applyFilters(listQuery);

    const [total, rows] = await Promise.all([
      countQuery.getCount(),
      listQuery.getRawMany<{
        id: number;
        title: string;
        categoryName: string | null;
        status: TourStatus;
        timesCount: string;
      }>(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        categoryName: row.categoryName,
        status: row.status,
        timesCount: Number(row.timesCount),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(tourId: number): Promise<AdminTourDetailResponse> {
    const tour = await this.toursRepository.findOne({
      where: { id: tourId },
      relations: { category: true },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        category: { id: true, name: true },
      },
    });
    if (!tour) {
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
      id: tour.id,
      category: tour.category,
      title: tour.title,
      description: tour.description,
      status: tour.status,
      images: images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        sortOrder: image.sortOrder,
      })),
    };
  }

  async update(
    tourId: number,
    dto: UpdateTourDto,
  ): Promise<UpdateTourResponse> {
    const categoryExists = await this.categoriesService.exists(dto.categoryId);
    if (!categoryExists) {
      throw new NotFoundException({
        code: 'TOUR_OR_CATEGORY_NOT_FOUND',
        message: this.i18n.t('tours.tour_or_category_not_found'),
      });
    }

    let result: UpdateResult;
    try {
      result = await this.toursRepository.update(tourId, {
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
      });
    } catch (error) {
      // Closes the gap between the exists() check above and this write — the
      // category could have been deleted in between.
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException({
          code: 'TOUR_OR_CATEGORY_NOT_FOUND',
          message: this.i18n.t('tours.tour_or_category_not_found'),
        });
      }
      throw error;
    }
    if (!result.affected) {
      throw new NotFoundException({
        code: 'TOUR_OR_CATEGORY_NOT_FOUND',
        message: this.i18n.t('tours.tour_or_category_not_found'),
      });
    }
    return { id: tourId, title: dto.title };
  }

  async updateStatus(
    tourId: number,
    status: TourStatus,
  ): Promise<UpdateTourStatusResponse> {
    const updatedAt = new Date();

    if (status === TourStatus.PUBLISHED) {
      // Tour times can be deleted (ADMIN-TIME-04), so the "has a tour time"
      // check must be part of the same statement as the update — a separate
      // check-then-act could race with a concurrent delete of the last one.
      // UPDATE/DELETE via Repository.query() returns [rows, rowCount], not
      // just the rows array — destructure it, don't check rows.length.
      const [, affectedCount] = await this.toursRepository.query<
        [{ id: number }[], number]
      >(
        `UPDATE tours SET status = $1, updated_at = $2
         WHERE id = $3 AND EXISTS (SELECT 1 FROM tour_times WHERE tour_id = tours.id)
         RETURNING id`,
        [status, updatedAt, tourId],
      );
      if (affectedCount) {
        return { id: tourId, status, updatedAt };
      }
      const exists = await this.toursRepository.exists({
        where: { id: tourId },
      });
      if (!exists) {
        throw new NotFoundException({
          code: 'TOUR_NOT_FOUND',
          message: this.i18n.t('tours.tour_not_found'),
        });
      }
      throw new ConflictException({
        code: 'TOUR_HAS_NO_TOUR_TIME',
        message: this.i18n.t('tours.tour_has_no_tour_time'),
      });
    }

    const result = await this.toursRepository.update(tourId, {
      status,
      updatedAt,
    });
    if (!result.affected) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: this.i18n.t('tours.tour_not_found'),
      });
    }
    return { id: tourId, status, updatedAt };
  }

  async remove(tourId: number): Promise<void> {
    let result: DeleteResult;
    try {
      result = await this.toursRepository.delete(tourId);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException({
          code: 'TOUR_HAS_TOUR_TIMES',
          message: this.i18n.t('tours.tour_has_tour_times'),
        });
      }
      throw error;
    }
    if (!result.affected) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: this.i18n.t('tours.tour_not_found'),
      });
    }
  }
}
