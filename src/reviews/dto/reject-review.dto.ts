import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class RejectReviewDto {
  @ApiProperty({ example: 'Nội dung không phù hợp' })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  reason: string;
}
