import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { REFRESH_TOKEN_COOKIE } from './auth.constants';

function refreshTokenCookieOptions(
  configService: ConfigService,
): CookieOptions {
  return {
    httpOnly: true,
    secure: configService.get('NODE_ENV') === 'production',
    sameSite: 'lax',
  };
}

export function setRefreshTokenCookie(
  res: Response,
  configService: ConfigService,
  refreshToken: string,
  expiresAt: Date,
): void {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...refreshTokenCookieOptions(configService),
    expires: expiresAt,
  });
}

export function clearRefreshTokenCookie(
  res: Response,
  configService: ConfigService,
): void {
  res.clearCookie(
    REFRESH_TOKEN_COOKIE,
    refreshTokenCookieOptions(configService),
  );
}
