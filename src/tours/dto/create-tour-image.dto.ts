import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUrl, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateTourImageDto {
  @ApiProperty({ example: 'https://cdn.example.com/tours/1/photo1.jpg' })
  @IsUrl({}, { message: i18nValidationMessage('validation.is_url') })
  imageUrl: string;

  @ApiProperty({ example: 0 })
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  sortOrder: number;
}
