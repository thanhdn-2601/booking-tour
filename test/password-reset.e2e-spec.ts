import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { User } from './../src/users/user.entity';
import { UserStatus } from './../src/users/user-status.enum';
import { truncateAllTables } from './utils/database-cleaner';

interface ErrorBody {
  code: string;
}

interface ForgotPasswordBody {
  status: string;
  resetToken?: string;
}

describe('Password reset (e2e)', () => {
  let app: NestExpressApplication<App>;
  let dataSource: DataSource;

  const password = 'P@ssw0rd123';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication<App>>();
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  async function createUser(overrides: Partial<User> = {}): Promise<User> {
    const usersRepository = dataSource.getRepository(User);
    const user = usersRepository.create({
      email: 'user@example.com',
      password: await bcrypt.hash(password, 10),
      fullName: 'Nguyen Van A',
      phone: '0900000000',
      status: UserStatus.ACTIVE,
      ...overrides,
    });
    return usersRepository.save(user);
  }

  function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  describe('POST /api/v1/auth/forgot-password', () => {
    it('issues a reset token for an active user with an existing password', async () => {
      const user = await createUser({ email: 'target@example.com' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'target@example.com' })
        .expect(200);

      const body = res.body as ForgotPasswordBody;
      expect(body.status).toBe('RESET_EMAIL_SENT');
      expect(body.resetToken).toEqual(expect.any(String));

      const updated = await dataSource
        .getRepository(User)
        .findOneByOrFail({ id: user.id });
      expect(updated.passwordResetTokenHash).toBe(
        hashToken(body.resetToken as string),
      );
      expect(updated.passwordResetTokenExpiresAt).not.toBeNull();
    });

    it('issues a reset token for a user with no password yet (seeded admin)', async () => {
      await createUser({ email: 'admin@example.com', password: null });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@example.com' })
        .expect(200);

      expect((res.body as ForgotPasswordBody).resetToken).toEqual(
        expect.any(String),
      );
    });

    it('responds the same way for an unregistered email, without a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      const body = res.body as ForgotPasswordBody;
      expect(body.status).toBe('RESET_EMAIL_SENT');
      expect(body.resetToken).toBeUndefined();
    });

    it('does not issue a token for an inactive user', async () => {
      await createUser({
        email: 'inactive@example.com',
        status: UserStatus.INACTIVE,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'inactive@example.com' })
        .expect(200);

      expect((res.body as ForgotPasswordBody).resetToken).toBeUndefined();
    });

    it('rejects an invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('sets a new password end-to-end using the token from forgot-password', async () => {
      await createUser({ email: 'target@example.com' });

      const forgotRes = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'target@example.com' })
        .expect(200);
      const token = (forgotRes.body as ForgotPasswordBody).resetToken;

      const newPassword = 'N3w-P@ssw0rd';
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword })
        .expect(200)
        .expect({ status: 'PASSWORD_RESET' });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'target@example.com', password: newPassword })
        .expect(200);

      const updated = await dataSource
        .getRepository(User)
        .findOneByOrFail({ email: 'target@example.com' });
      expect(updated.passwordResetTokenHash).toBeNull();
      expect(updated.passwordResetTokenExpiresAt).toBeNull();
    });

    it('lets a user with no password set one for the first time', async () => {
      await createUser({ email: 'admin@example.com', password: null });

      const forgotRes = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@example.com' })
        .expect(200);
      const token = (forgotRes.body as ForgotPasswordBody).resetToken;

      const newPassword = 'N3w-P@ssw0rd';
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.com', password: newPassword })
        .expect(200);
    });

    it('revokes existing sessions once the password is reset', async () => {
      await createUser({ email: 'target@example.com' });
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'target@example.com', password })
        .expect(200);
      const refreshTokenCookie = (
        loginRes.headers['set-cookie'] as unknown as string[]
      )[0].split(';')[0];

      const forgotRes = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'target@example.com' })
        .expect(200);
      const token = (forgotRes.body as ForgotPasswordBody).resetToken;

      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword: 'N3w-P@ssw0rd' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(401);
      expect((res.body as ErrorBody).code).toBe('SESSION_REVOKED_OR_EXPIRED');
    });

    it('rejects an unknown token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'does-not-exist', newPassword: 'N3w-P@ssw0rd' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe(
        'RESET_TOKEN_INVALID_OR_EXPIRED',
      );
    });

    it('rejects an expired token', async () => {
      const rawToken = 'expired-reset-token';
      await createUser({
        email: 'target@example.com',
        passwordResetTokenHash: hashToken(rawToken),
        passwordResetTokenExpiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'N3w-P@ssw0rd' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe(
        'RESET_TOKEN_INVALID_OR_EXPIRED',
      );
    });

    it('rejects an invalid request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'some-token', newPassword: 'short' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
