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
import { UserRole } from './../src/users/user-role.enum';
import { UserStatus } from './../src/users/user-status.enum';
import { truncateAllTables } from './utils/database-cleaner';

interface LoginBody {
  accessToken: string;
}

interface ErrorBody {
  code: string;
}

interface AdminUserListItem {
  id: number;
  email: string;
  fullName: string;
  role: string;
  status: string;
}

interface AdminUserListBody {
  items: AdminUserListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

describe('Admin users (e2e)', () => {
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
      role: UserRole.USER,
      ...overrides,
    });
    return usersRepository.save(user);
  }

  async function login(email: string): Promise<{
    accessToken: string;
    refreshTokenCookie: string;
  }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return {
      accessToken: (res.body as LoginBody).accessToken,
      refreshTokenCookie: cookies[0].split(';')[0],
    };
  }

  async function createAdminAndLogin(): Promise<string> {
    await createUser({ email: 'admin@example.com', role: UserRole.ADMIN });
    const { accessToken } = await login('admin@example.com');
    return accessToken;
  }

  describe('GET /api/v1/admin/users', () => {
    it('rejects a request without an access token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .expect(401);
    });

    it('rejects a non-admin user', async () => {
      await createUser();
      const { accessToken } = await login('user@example.com');

      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('lists users with pagination', async () => {
      const adminToken = await createAdminAndLogin();
      await createUser({ email: 'user1@example.com' });
      await createUser({ email: 'user2@example.com' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as AdminUserListBody;
      expect(body.items).toHaveLength(3);
      expect(body.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 3,
        totalPages: 1,
      });
      expect(body.items[0]).not.toHaveProperty('password');
    });

    it('filters by role and search', async () => {
      const adminToken = await createAdminAndLogin();
      await createUser({
        email: 'target@example.com',
        fullName: 'Target User',
      });
      await createUser({
        email: 'other@example.com',
        fullName: 'Someone Else',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .query({ role: 'user', search: 'Target' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as AdminUserListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].email).toBe('target@example.com');
    });
  });

  describe('GET /api/v1/admin/users/:userId', () => {
    it('returns 404 for a user that does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('USER_NOT_FOUND');
    });

    it('returns the full user detail', async () => {
      const adminToken = await createAdminAndLogin();
      const target = await createUser({ email: 'target@example.com' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: target.id,
        email: 'target@example.com',
        fullName: 'Nguyen Van A',
        phone: '0900000000',
        role: 'user',
        status: 'active',
      });
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/status', () => {
    it('rejects a non-admin user', async () => {
      const target = await createUser();
      const { accessToken } = await login('user@example.com');

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'inactive' })
        .expect(403);
    });

    it('returns 409 when the status is unchanged', async () => {
      const adminToken = await createAdminAndLogin();
      const target = await createUser({ status: UserStatus.ACTIVE });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('STATUS_UNCHANGED');
    });

    it('deactivating a user revokes their active refresh session', async () => {
      const adminToken = await createAdminAndLogin();
      const target = await createUser({ email: 'target@example.com' });
      const { refreshTokenCookie } = await login('target@example.com');

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(401);

      expect((res.body as ErrorBody).code).toBe('SESSION_REVOKED_OR_EXPIRED');
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/role', () => {
    it('returns 404 for a user that does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/admin/users/999999/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('USER_NOT_FOUND');
    });

    it('updates the role', async () => {
      const adminToken = await createAdminAndLogin();
      const target = await createUser({ email: 'target@example.com' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(res.body).toMatchObject({ id: target.id, role: 'admin' });
    });

    it('rejects an invalid role value', async () => {
      const adminToken = await createAdminAndLogin();
      const target = await createUser({ email: 'target@example.com' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
