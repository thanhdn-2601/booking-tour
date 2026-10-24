import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTourImageDto } from '../tours/dto/create-tour-image.dto';
import { UpdateTourImageDto } from '../tours/dto/update-tour-image.dto';
import { RemoveUploadedFileOnErrorInterceptor } from '../tours/interceptors/remove-uploaded-file-on-error.interceptor';
import { TourImageListResponse } from '../tours/interfaces/tour-image-list-response.interface';
import { TourImageResponse } from '../tours/interfaces/tour-image-response.interface';
import { UpdateTourImageResponse } from '../tours/interfaces/update-tour-image-response.interface';
import { MulterExceptionFilter } from '../tours/multer-exception.filter';
import {
  tourImageUploadOptions,
  tourImageValidationPipe,
} from '../tours/tour-image-upload.options';
import { TourImagesService } from '../tours/tour-images.service';
import { UserRole } from '../users/user-role.enum';

@ApiTags('admin-tour-images')
@ApiSecurity('bearer')
@Controller('admin/tours/:tourId/images')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTourImagesController {
  constructor(private readonly tourImagesService: TourImagesService) {}

  @ApiOperation({ summary: 'Upload an image for a tour' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        sortOrder: { type: 'integer', example: 0 },
      },
      required: ['file', 'sortOrder'],
    },
  })
  @Post()
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', tourImageUploadOptions),
    RemoveUploadedFileOnErrorInterceptor,
  )
  create(
    @Param('tourId', ParseIntPipe) tourId: number,
    @UploadedFile(tourImageValidationPipe) file: Express.Multer.File,
    @Body() dto: CreateTourImageDto,
  ): Promise<TourImageResponse> {
    return this.tourImagesService.create(tourId, file, dto);
  }

  @ApiOperation({ summary: "List a tour's images" })
  @Get()
  list(
    @Param('tourId', ParseIntPipe) tourId: number,
  ): Promise<TourImageListResponse> {
    return this.tourImagesService.findAllForTour(tourId);
  }

  @ApiOperation({ summary: "Update an image's sort order" })
  @Patch(':imageId')
  update(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body() dto: UpdateTourImageDto,
  ): Promise<UpdateTourImageResponse> {
    return this.tourImagesService.update(tourId, imageId, dto);
  }

  @ApiOperation({ summary: 'Delete an image' })
  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ): Promise<void> {
    return this.tourImagesService.remove(tourId, imageId);
  }
}
