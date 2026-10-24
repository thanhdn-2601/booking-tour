import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import type { Request } from 'express';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';

@Injectable()
export class RemoveUploadedFileOnErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const request = context
          .switchToHttp()
          .getRequest<Request & { file?: Express.Multer.File }>();
        const path = request.file?.path;
        if (!path) return throwError(() => error);

        return from(fs.unlink(path).catch(() => undefined)).pipe(
          switchMap(() => throwError(() => error)),
        );
      }),
    );
  }
}
