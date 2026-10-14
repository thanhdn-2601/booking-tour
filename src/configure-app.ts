import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { PUBLIC_DIR } from './common/public-dir';
import { validationExceptionFactory } from './common/validation-exception-factory';

export function configureApp(app: NestExpressApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useStaticAssets(PUBLIC_DIR);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
}
