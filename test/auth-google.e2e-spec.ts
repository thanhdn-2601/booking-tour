import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { AuthService } from './../src/auth/auth.service';
import { configureApp } from './../src/configure-app';
import { AuthIdentity } from './../src/auth/entities/auth-identity.entity';
import { OAuthProfile } from './../src/auth/interfaces/oauth-profile.interface';
import { OAuthProvider } from './../src/auth/oauth-provider.enum';
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

describe('Auth Google OAuth (e2e)', () => {
  let app: NestExpressApplication<App>;
  let dataSource: DataSource;
  let authService: AuthService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication<App>>();
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    authService = app.get(AuthService);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  function fakeProfile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
    return {
      provider: OAuthProvider.GOOGLE,
      providerUserId: 'google-user-1',
      email: 'ngocthanh@gmail.com',
      fullName: 'Ngoc Thanh',
      ...overrides,
    };
  }

  describe('GET /api/v1/auth/google', () => {
    it('redirects to the Google consent screen and sets the state cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/google')
        .expect(302);

      const location = new URL(res.headers.location);
      expect(location.origin + location.pathname).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(location.searchParams.get('client_id')).toBe(
        process.env.GOOGLE_CLIENT_ID,
      );
      expect(location.searchParams.get('redirect_uri')).toBe(
        process.env.GOOGLE_CALLBACK_URL,
      );
      expect(location.searchParams.get('scope')).toBe('email profile');
      expect(location.searchParams.get('state')).toBeTruthy();

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies?.[0]).toMatch(/^oauth_state=.+HttpOnly/);
    });
  });

  describe('GET /api/v1/auth/google/callback', () => {
    it('rejects a callback without an oauth_state cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/google/callback')
        .query({ code: 'fake-code', state: 'anything' })
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('OAUTH_STATE_INVALID');
    });

    it('rejects a callback whose state does not match the cookie', async () => {
      const initiateRes = await request(app.getHttpServer())
        .get('/api/v1/auth/google')
        .expect(302);
      const cookies = initiateRes.headers['set-cookie'] as unknown as string[];

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/google/callback')
        .set('Cookie', cookies[0])
        .query({ code: 'fake-code', state: 'tampered-state' })
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('OAUTH_STATE_INVALID');
    });
  });

  describe('AuthService.loginWithGoogle', () => {
    it('creates a new active user and links an auth identity', async () => {
      const result = await authService.loginWithGoogle(fakeProfile());

      const body = result.response as LoginBody;
      expect(body.accessToken).toEqual(expect.any(String));

      const usersRepository = dataSource.getRepository(User);
      const user = await usersRepository.findOneOrFail({
        where: { email: 'ngocthanh@gmail.com' },
      });
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(user.password).toBeNull();

      const identities = await dataSource
        .getRepository(AuthIdentity)
        .find({ where: { userId: user.id } });
      expect(identities).toHaveLength(1);
      expect(identities[0]).toMatchObject({
        provider: OAuthProvider.GOOGLE,
        providerUserId: 'google-user-1',
      });
    });

    it('logs the same Google account in again without creating a duplicate', async () => {
      const first = await authService.loginWithGoogle(fakeProfile());
      const second = await authService.loginWithGoogle(fakeProfile());

      expect(second.response.accessToken).toEqual(expect.any(String));
      expect(first.response.accessToken).not.toBe(second.response.accessToken);

      const usersRepository = dataSource.getRepository(User);
      const users = await usersRepository.find();
      expect(users).toHaveLength(1);

      const identities = await dataSource.getRepository(AuthIdentity).find();
      expect(identities).toHaveLength(1);
    });

    it('links to an existing user with the same email', async () => {
      const usersRepository = dataSource.getRepository(User);
      const existing = await usersRepository.save(
        usersRepository.create({
          email: 'ngocthanh@gmail.com',
          password: null,
          fullName: 'Ngoc Thanh',
          status: UserStatus.ACTIVE,
        }),
      );

      await authService.loginWithGoogle(fakeProfile());

      const users = await usersRepository.find();
      expect(users).toHaveLength(1);

      const identities = await dataSource
        .getRepository(AuthIdentity)
        .find({ where: { userId: existing.id } });
      expect(identities).toHaveLength(1);
    });

    it('rejects linking into an inactive existing user', async () => {
      const usersRepository = dataSource.getRepository(User);
      await usersRepository.save(
        usersRepository.create({
          email: 'ngocthanh@gmail.com',
          password: null,
          fullName: 'Ngoc Thanh',
          status: UserStatus.INACTIVE,
        }),
      );

      await expect(
        authService.loginWithGoogle(fakeProfile()),
      ).rejects.toMatchObject({
        response: { code: 'USER_INACTIVE' },
      });
    });

    it('creates exactly one user when the same profile logs in concurrently', async () => {
      await Promise.all([
        authService.loginWithGoogle(fakeProfile()),
        authService.loginWithGoogle(fakeProfile()),
        authService.loginWithGoogle(fakeProfile()),
      ]);

      const users = await dataSource.getRepository(User).find();
      expect(users).toHaveLength(1);

      const identities = await dataSource.getRepository(AuthIdentity).find();
      expect(identities).toHaveLength(1);
    });
  });
});
