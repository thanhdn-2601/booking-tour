import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination.constants';
import { RATING_MAX, RATING_MIN } from '../reviews.constants';
import { ReviewStatus } from '../review-status.enum';

export class AdminListReviewsQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus, {
    message: i18nValidationMessage('validation.is_enum'),
  })
  status?: ReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  tourId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(RATING_MIN, { message: i18nValidationMessage('validation.min') })
  @Max(RATING_MAX, { message: i18nValidationMessage('validation.max') })
  rating?: number;

  @ApiPropertyOptional({ default: DEFAULT_PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(MAX_PAGE_SIZE, { message: i18nValidationMessage('validation.max') })
  pageSize: number = DEFAULT_PAGE_SIZE;
}
