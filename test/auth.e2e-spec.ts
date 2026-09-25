import { INestApplication } from '@nestjs/common';
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

interface LoginBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const password = 'P@ssw0rd123';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  async function createUnactivatedUser(
    rawActivationToken: string,
    overrides: Partial<User> = {},
  ): Promise<User> {
    return createUser({
      email: 'guest@example.com',
      status: UserStatus.INACTIVE,
      activationTokenHash: hashToken(rawActivationToken),
      activationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    });
  }

  describe('POST /api/v1/auth/register', () => {
    it('creates an inactive user with a lowercased email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'Guest@Example.com',
          password,
          fullName: 'Nguyen Van A',
          phone: '0900000000',
        })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(Number) as number,
        email: 'guest@example.com',
        fullName: 'Nguyen Van A',
        role: 'user',
        status: 'inactive',
        activationToken: expect.any(String) as string,
      });

      const user = await dataSource
        .getRepository(User)
        .findOneOrFail({ where: { email: 'guest@example.com' } });
      expect(user.password).not.toBe(password);
      expect(user.activationTokenHash).not.toBeNull();
      expect(user.emailVerifiedAt).toBeNull();
    });

    it('rejects a duplicate email regardless of case', async () => {
      await createUser({ email: 'user@example.com' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'USER@example.com',
          password,
          fullName: 'Someone Else',
          phone: '0900000001',
        })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('rejects an invalid request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it('rejects a password over 72 bytes even if under 72 characters', async () => {
      // 30 Vietnamese characters, 3 bytes each = 90 bytes — bcrypt truncates
      // at 72 bytes, so an unbounded-by-bytes password risks collisions.
      const password = 'ệ'.repeat(24) + 'AAAAAA';
      expect(password.length).toBeLessThan(72);
      expect(Buffer.byteLength(password, 'utf8')).toBeGreaterThan(72);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'longpw@example.com',
          password,
          fullName: 'Long Password',
          phone: '0900000000',
        })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/auth/activate', () => {
    it('activates the account end-to-end using the token from the register response', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'guest@example.com',
          password,
          fullName: 'Nguyen Van A',
          phone: '0900000000',
        })
        .expect(201);

      const token = (registerRes.body as { activationToken?: string })
        .activationToken;
      expect(token).toBeDefined();

      await request(app.getHttpServer())
        .get('/api/v1/auth/activate')
        .query({ token })
        .expect(200)
        .expect({ status: 'ACTIVATED' });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'guest@example.com', password })
        .expect(200);
    });

    it('rejects an unknown token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/activate')
        .query({ token: 'does-not-exist' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('rejects an expired token', async () => {
      const rawToken = 'expired-token-value';
      await createUnactivatedUser(rawToken, {
        activationTokenExpiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/activate')
        .query({ token: rawToken })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('rejects an already-activated account', async () => {
      const rawToken = 'already-used-token';
      await createUnactivatedUser(rawToken, { status: UserStatus.ACTIVE });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/activate')
        .query({ token: rawToken })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('ALREADY_ACTIVATED');
    });

    it('rejects a missing token query param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/activate')
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with valid credentials and sets a refresh token cookie', async () => {
      await createUser();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(200);

      const body = res.body as LoginBody;
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.any() is untyped by design */
      expect(body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: expect.any(Number),
      });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies?.[0]).toMatch(/^refresh_token=.+HttpOnly/);
    });

    it('rejects an unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password })
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects a wrong password', async () => {
      await createUser();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'wrong-password' })
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects an inactive user', async () => {
      await createUser({ status: UserStatus.INACTIVE });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(403);

      expect((res.body as ErrorBody).code).toBe('USER_INACTIVE');
    });

    it('rejects an invalid request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('rejects a request without an access token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });

    it('revokes the current session and clears the cookie', async () => {
      await createUser();

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(200);

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const { accessToken } = loginRes.body as LoginBody;

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies[0])
        .expect(204);

      const sessions = await dataSource.query<{ revoked_at: Date | null }[]>(
        'SELECT revoked_at FROM user_auth_sessions',
      );
      expect(sessions).toHaveLength(1);
      expect(sessions[0].revoked_at).not.toBeNull();
    });

    it('rejects an access token whose user has since been deactivated', async () => {
      const user = await createUser();

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(200);
      const { accessToken } = loginRes.body as LoginBody;

      await dataSource
        .getRepository(User)
        .update(user.id, { status: UserStatus.INACTIVE });

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rejects a request without a refresh token cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('rejects a garbage refresh token cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refresh_token=not-a-real-token')
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('issues a new access token and rotates the refresh token cookie', async () => {
      await createUser();

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(200);
      const loginCookies = loginRes.headers[
        'set-cookie'
      ] as unknown as string[];

      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', loginCookies[0])
        .expect(200);

      const body = refreshRes.body as LoginBody;
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.any() is untyped by design */
      expect(body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: expect.any(Number),
      });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */

      const refreshCookies = refreshRes.headers[
        'set-cookie'
      ] as unknown as string[];
      expect(refreshCookies[0]).not.toBe(loginCookies[0]);

      const sessions = await dataSource.query<{ revoked_at: Date | null }[]>(
        'SELECT revoked_at FROM user_auth_sessions ORDER BY id',
      );
      expect(sessions).toHaveLength(2);
      expect(sessions[0].revoked_at).not.toBeNull();
      expect(sessions[1].revoked_at).toBeNull();
    });

    it('rejects reuse of an already-rotated refresh token', async () => {
      await createUser();

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(200);
      const loginCookies = loginRes.headers[
        'set-cookie'
      ] as unknown as string[];

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', loginCookies[0])
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', loginCookies[0])
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('SESSION_REVOKED_OR_EXPIRED');
    });

    it('rejects a session whose user has since been deactivated', async () => {
      const user = await createUser();

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(200);
      const loginCookies = loginRes.headers[
        'set-cookie'
      ] as unknown as string[];

      await dataSource
        .getRepository(User)
        .update(user.id, { status: UserStatus.INACTIVE });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', loginCookies[0])
        .expect(403);

      expect((res.body as ErrorBody).code).toBe('USER_INACTIVE');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
