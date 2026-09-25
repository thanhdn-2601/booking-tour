import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { LoginResponse } from '../interfaces/login-response.interface';
import { LoginResult } from '../interfaces/login-result.interface';
import { setRefreshTokenCookie } from '../refresh-token-cookie.util';

@Injectable()
export class RefreshTokenCookieInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<LoginResult>,
  ): Observable<LoginResponse> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((result) => {
        setRefreshTokenCookie(
          res,
          this.configService,
          result.refreshToken,
          result.refreshTokenExpiresAt,
        );
        return result.response;
      }),
    );
  }
}
