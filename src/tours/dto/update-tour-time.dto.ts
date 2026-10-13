import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { TourTimeStatus } from '../tour-time-status.enum';

export class UpdateTourTimeDto {
  @ApiProperty({ example: 3900000 })
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  price: number;

  @ApiProperty({ example: 25 })
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  maxCapacity: number;

  @ApiProperty({ enum: TourTimeStatus })
  @IsEnum(TourTimeStatus, {
    message: i18nValidationMessage('validation.is_enum'),
  })
  status: TourTimeStatus;
}
