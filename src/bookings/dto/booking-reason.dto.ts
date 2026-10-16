import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class BookingReasonDto {
  @ApiPropertyOptional({ example: 'Tour đã hết chỗ' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  reason?: string;
}
