import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination.constants';

export class ListToursQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  categoryId?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  maxPrice?: number;

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
