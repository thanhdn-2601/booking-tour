import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';

import { GOOGLE_STRATEGY, OAUTH_STATE_COOKIE } from '../auth.constants';
import { clearOAuthStateCookie } from '../oauth-state-cookie.util';

@Injectable()
export class GoogleCallbackAuthGuard extends AuthGuard(GOOGLE_STRATEGY) {
  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const cookieState = request.cookies?.[OAUTH_STATE_COOKIE] as
      string | undefined;
    clearOAuthStateCookie(response, this.configService);

    if (!cookieState || cookieState !== request.query.state) {
      throw new UnauthorizedException({
        code: 'OAUTH_STATE_INVALID',
        message: this.i18n.t('auth.oauth_state_invalid'),
      });
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser>(error: unknown, user: TUser | false): TUser {
    if (error instanceof UnauthorizedException) throw error;
    if (error || !user) throw new UnauthorizedException();
    return user;
  }
}
