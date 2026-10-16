import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { DEFAULT_PAGE, MAX_PAGE_SIZE } from '../../common/pagination.constants';
import { PUBLIC_CATEGORIES_DEFAULT_PAGE_SIZE } from '../categories.constants';

export class ListCategoriesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  search?: string;

  @ApiPropertyOptional({ default: DEFAULT_PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: PUBLIC_CATEGORIES_DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(MAX_PAGE_SIZE, { message: i18nValidationMessage('validation.max') })
  pageSize: number = PUBLIC_CATEGORIES_DEFAULT_PAGE_SIZE;
}
