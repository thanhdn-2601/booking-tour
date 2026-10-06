import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Du lịch biển' })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  name: string;

  @ApiProperty({ example: 'Các tour biển đảo' })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  description: string;
}
