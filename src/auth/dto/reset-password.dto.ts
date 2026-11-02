import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../password.constants';
import { MaxByteLength } from '../validators/max-byte-length.decorator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token received by email' })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  token: string;

  @ApiProperty({
    example: 'Aa@123456',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: i18nValidationMessage('validation.min_length'),
  })
  @MaxByteLength(PASSWORD_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_byte_length'),
  })
  newPassword: string;
}
