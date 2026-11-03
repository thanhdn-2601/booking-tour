import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ngocthanh@gmail.com' })
  @IsEmail({}, { message: i18nValidationMessage('validation.is_email') })
  email: string;
}
