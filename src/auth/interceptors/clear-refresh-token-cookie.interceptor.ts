import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { clearRefreshTokenCookie } from '../refresh-token-cookie.util';

@Injectable()
export class ClearRefreshTokenCookieInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next
      .handle()
      .pipe(tap(() => clearRefreshTokenCookie(res, this.configService)));
  }
}
