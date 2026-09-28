import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { User } from './../src/users/user.entity';
import { UserStatus } from './../src/users/user-status.enum';
import { truncateAllTables } from './utils/database-cleaner';

interface LoginBody {
  accessToken: string;
}

interface UserProfileBody {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
}

describe('Users (e2e)', () => {
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

  async function loginAndGetToken(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password })
      .expect(200);
    return (res.body as LoginBody).accessToken;
  }

  describe('GET /api/v1/me', () => {
    it('rejects a request without an access token', () => {
      return request(app.getHttpServer()).get('/api/v1/me').expect(401);
    });

    it('returns the current user profile without the password', async () => {
      await createUser();
      const accessToken = await loginAndGetToken();

      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as UserProfileBody & { password?: unknown };
      expect(body).toEqual({
        id: expect.any(Number) as number,
        email: 'user@example.com',
        fullName: 'Nguyen Van A',
        phone: '0900000000',
        role: 'user',
        status: 'active',
      });
      expect(body.password).toBeUndefined();
    });
  });

  describe('PATCH /api/v1/me', () => {
    it('rejects a request without an access token', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/me')
        .send({ fullName: 'New Name' })
        .expect(401);
    });

    it('updates fullName and phone', async () => {
      await createUser();
      const accessToken = await loginAndGetToken();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fullName: 'Updated Name', phone: '0911111111' })
        .expect(200);

      const body = res.body as UserProfileBody;
      expect(body.fullName).toBe('Updated Name');
      expect(body.phone).toBe('0911111111');
    });

    it('only updates the field that was sent, leaving the other unchanged', async () => {
      await createUser();
      const accessToken = await loginAndGetToken();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fullName: 'Only Name Changed' })
        .expect(200);

      const body = res.body as UserProfileBody;
      expect(body.fullName).toBe('Only Name Changed');
      expect(body.phone).toBe('0900000000');
    });

    it('ignores email/role/status even if sent in the body', async () => {
      await createUser();
      const accessToken = await loginAndGetToken();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'hacked@example.com',
          role: 'admin',
          status: 'inactive',
          phone: '0922222222',
        })
        .expect(200);

      const body = res.body as UserProfileBody;
      expect(body.email).toBe('user@example.com');
      expect(body.role).toBe('user');
      expect(body.status).toBe('active');
      expect(body.phone).toBe('0922222222');
    });

    it('rejects an empty string for fullName', async () => {
      await createUser();
      const accessToken = await loginAndGetToken();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fullName: '' })
        .expect(400);

      expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
