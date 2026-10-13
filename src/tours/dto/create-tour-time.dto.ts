import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsPositive } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateTourTimeDto {
  @ApiProperty({ example: '2026-10-01' })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.is_date_string') },
  )
  startDate: string;

  @ApiProperty({ example: '2026-10-03' })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.is_date_string') },
  )
  endDate: string;

  @ApiProperty({ example: 3500000 })
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  price: number;

  @ApiProperty({ example: 20 })
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @IsPositive({ message: i18nValidationMessage('validation.is_positive') })
  maxCapacity: number;
}
