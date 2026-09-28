import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { REFRESH_TOKEN_COOKIE } from '../auth.constants';

export const RefreshTokenCookie = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
  },
);
