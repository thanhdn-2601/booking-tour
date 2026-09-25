import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('Tour Booking API')
    .setDescription('API documentation')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const configService = app.get(ConfigService);
  await app.listen(configService.getOrThrow<number>('PORT'));
}
bootstrap().catch((error: unknown) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
