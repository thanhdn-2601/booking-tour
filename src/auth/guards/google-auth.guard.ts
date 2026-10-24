import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { randomBytes } from 'crypto';
import type { Response } from 'express';

import { GOOGLE_STRATEGY, OAUTH_STATE_BYTES } from '../auth.constants';
import { setOAuthStateCookie } from '../oauth-state-cookie.util';

@Injectable()
export class GoogleAuthGuard extends AuthGuard(GOOGLE_STRATEGY) {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const res = context.switchToHttp().getResponse<Response>();
    const state = randomBytes(OAUTH_STATE_BYTES).toString('hex');
    setOAuthStateCookie(res, this.configService, state);
    return { state };
  }
}
