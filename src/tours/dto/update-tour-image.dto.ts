import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class UpdateTourImageDto {
  @ApiProperty({ example: 1 })
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  sortOrder: number;
}
