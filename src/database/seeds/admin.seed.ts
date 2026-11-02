import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { AuthService } from '../../auth/auth.service';
import { isUniqueViolation } from '../../common/postgres-errors';
import { UsersService } from '../../users/users.service';

const logger = new Logger('AdminSeed');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const email = app.get(ConfigService).getOrThrow<string>('SEED_ADMIN_EMAIL');
    const usersService = app.get(UsersService);

    if (await usersService.existsByEmail(email)) {
      logger.log(`Admin user already exists, skip seeding: ${email}`);
      return;
    }

    try {
      await usersService.createAdmin({ email, fullName: 'Admin' });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      logger.log(`Admin user was seeded concurrently, skip: ${email}`);
      return;
    }

    await app.get(AuthService).forgotPassword({ email });
    logger.log(`Seeded admin user and sent the account setup email: ${email}`);
  } finally {
    await app.close();
  }
}

void bootstrap();
