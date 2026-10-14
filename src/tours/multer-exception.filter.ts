import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

// @nestjs/platform-express's FileInterceptor transforms Multer's own errors
// internally before they ever reach a filter — LIMIT_FILE_SIZE specifically
// becomes a PayloadTooLargeException (413), not the raw MulterError — so
// catching MulterError alone never matches it. Catch both: MulterError is
// kept as a fallback in case a future Nest version emits the raw error
// instead. Either way, reshape it to this project's usual 400
// VALIDATION_ERROR — the documented error for this endpoint, not a 413.
@Catch(MulterError, PayloadTooLargeException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(
    error: MulterError | PayloadTooLargeException,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();
    const exception = new BadRequestException({
      code: 'VALIDATION_ERROR',
      errors: { file: [error.message] },
    });
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
