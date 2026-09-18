import { UnprocessableEntityException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

function collectErrors(
  errors: ValidationError[],
  acc: Record<string, string[]>,
): void {
  for (const error of errors) {
    if (error.constraints) {
      acc[error.property] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      collectErrors(error.children, acc);
    }
  }
}

export function validationExceptionFactory(
  errors: ValidationError[],
): UnprocessableEntityException {
  const formatted: Record<string, string[]> = {};
  collectErrors(errors, formatted);
  return new UnprocessableEntityException({ errors: formatted });
}
