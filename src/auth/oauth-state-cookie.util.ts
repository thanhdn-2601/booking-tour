import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SECONDS } from './auth.constants';

function oauthStateCookieOptions(configService: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: configService.get('NODE_ENV') === 'production',
    sameSite: 'lax',
    maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
  };
}

export function setOAuthStateCookie(
  res: Response,
  configService: ConfigService,
  state: string,
): void {
  res.cookie(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions(configService));
}

export function clearOAuthStateCookie(
  res: Response,
  configService: ConfigService,
): void {
  res.clearCookie(OAUTH_STATE_COOKIE, oauthStateCookieOptions(configService));
}
