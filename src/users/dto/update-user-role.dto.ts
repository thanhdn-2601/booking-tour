import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { UserRole } from '../user-role.enum';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole, { message: i18nValidationMessage('validation.is_enum') })
  role: UserRole;
}
