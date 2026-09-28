import { ValidationError } from 'class-validator';

export function collectValidationErrors(
  errors: ValidationError[],
  acc: Record<string, string[]> = {},
): Record<string, string[]> {
  for (const error of errors) {
    if (error.constraints) {
      acc[error.property] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      collectValidationErrors(error.children, acc);
    }
  }
  return acc;
}
