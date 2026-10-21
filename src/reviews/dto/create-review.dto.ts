import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { RATING_MAX, RATING_MIN } from '../reviews.constants';

export class CreateReviewDto {
  @ApiProperty({ example: 5 })
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(RATING_MIN, { message: i18nValidationMessage('validation.min') })
  @Max(RATING_MAX, { message: i18nValidationMessage('validation.max') })
  rating: number;

  @ApiProperty({ example: 'Tour rất tuyệt vời, hướng dẫn viên nhiệt tình' })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  comment: string;
}
