import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { UserStatus } from '../user-status.enum';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus, { message: i18nValidationMessage('validation.is_enum') })
  status: UserStatus;
}
