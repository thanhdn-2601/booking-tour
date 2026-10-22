import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ExtractJwt } from 'passport-jwt';

const extractBearerToken = ExtractJwt.fromAuthHeaderAsBearerToken();

export const CurrentAccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return extractBearerToken(request) ?? undefined;
  },
);
