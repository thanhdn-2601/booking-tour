import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { I18nContext } from 'nestjs-i18n';

import { collectValidationErrors } from './collect-validation-errors';

const I18N_MESSAGE_PATTERN = /^([\w.]+)\|(.*)$/;

function translateMessage(message: string, property: string): string {
  const match = I18N_MESSAGE_PATTERN.exec(message);
  if (!match) return message;

  const [, key, rawArgs] = match;
  const i18n = I18nContext.current();
  if (!i18n) return key;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs) as Record<string, unknown>;
  } catch {
    args = {};
  }
  return i18n.translate(key, { args: { property, ...args } });
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const raw = collectValidationErrors(errors);
  const formatted: Record<string, string[]> = {};
  for (const [property, messages] of Object.entries(raw)) {
    formatted[property] = messages.map((message) =>
      translateMessage(message, property),
    );
  }
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    errors: formatted,
  });
}
