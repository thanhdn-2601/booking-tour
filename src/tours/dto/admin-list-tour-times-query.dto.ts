import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination.constants';
import { TourTimeStatus } from '../tour-time-status.enum';

export class AdminListTourTimesQueryDto {
  @ApiPropertyOptional({ enum: TourTimeStatus })
  @IsOptional()
  @IsEnum(TourTimeStatus, {
    message: i18nValidationMessage('validation.is_enum'),
  })
  status?: TourTimeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.is_date_string') },
  )
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.is_date_string') },
  )
  endDate?: string;

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
