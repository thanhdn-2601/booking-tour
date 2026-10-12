import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { TourStatus } from '../tour-status.enum';

export class UpdateTourStatusDto {
  @ApiProperty({ enum: TourStatus })
  @IsEnum(TourStatus, { message: i18nValidationMessage('validation.is_enum') })
  status: TourStatus;
}
