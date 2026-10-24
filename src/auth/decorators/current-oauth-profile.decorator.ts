import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { OAuthProfile } from '../interfaces/oauth-profile.interface';

export const CurrentOAuthProfile = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OAuthProfile => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: OAuthProfile }>();
    return request.user;
  },
);
