import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { Category } from './../src/categories/category.entity';
import { configureApp } from './../src/configure-app';
import { Tour } from './../src/tours/tour.entity';
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

interface CategoryBody {
  id: number;
  name: string;
  description?: string;
}

interface CategoryListBody {
  items: { id: number; name: string; tourCount: number }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

describe('Admin categories (e2e)', () => {
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

  async function createAdminAndLogin(): Promise<string> {
    const usersRepository = dataSource.getRepository(User);
    await usersRepository.save(
      usersRepository.create({
        email: 'admin@example.com',
        password: await bcrypt.hash(password, 10),
        fullName: 'Admin',
        phone: '0900000000',
        status: UserStatus.ACTIVE,
        role: UserRole.ADMIN,
      }),
    );
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password })
      .expect(200);
    return (res.body as LoginBody).accessToken;
  }

  async function createCategory(
    overrides: Partial<Category> = {},
  ): Promise<Category> {
    const categoriesRepository = dataSource.getRepository(Category);
    const category = categoriesRepository.create({
      name: 'Du lịch biển',
      description: 'Các tour biển đảo',
      ...overrides,
    });
    return categoriesRepository.save(category);
  }

  describe('POST /api/v1/admin/categories', () => {
    it('rejects a non-admin user', async () => {
      const usersRepository = dataSource.getRepository(User);
      await usersRepository.save(
        usersRepository.create({
          email: 'user@example.com',
          password: await bcrypt.hash(password, 10),
          fullName: 'User',
          phone: '0900000000',
          status: UserStatus.ACTIVE,
          role: UserRole.USER,
        }),
      );
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/admin/categories')
        .set(
          'Authorization',
          `Bearer ${(loginRes.body as LoginBody).accessToken}`,
        )
        .send({ name: 'Du lịch biển', description: 'Các tour biển đảo' })
        .expect(403);
    });

    it('creates a category', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Du lịch biển', description: 'Các tour biển đảo' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Du lịch biển',
        description: 'Các tour biển đảo',
      });
    });

    it('returns 409 when the name already exists', async () => {
      const adminToken = await createAdminAndLogin();
      await createCategory({ name: 'Du lịch biển' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Du lịch biển', description: 'Khác' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('CATEGORY_NAME_EXISTS');
    });

    it('rejects a missing description', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Du lịch biển' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/admin/categories', () => {
    it('lists categories with tourCount', async () => {
      const adminToken = await createAdminAndLogin();
      const category = await createCategory({ name: 'Du lịch biển' });
      await createCategory({ name: 'Du lịch núi' });

      const toursRepository = dataSource.getRepository(Tour);
      await toursRepository.save([
        toursRepository.create({ categoryId: category.id }),
        toursRepository.create({ categoryId: category.id }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as CategoryListBody;
      expect(body.pagination.total).toBe(2);
      const bienCategory = body.items.find(
        (item) => item.name === 'Du lịch biển',
      );
      const nuiCategory = body.items.find(
        (item) => item.name === 'Du lịch núi',
      );
      expect(bienCategory?.tourCount).toBe(2);
      expect(nuiCategory?.tourCount).toBe(0);
    });

    it('filters by search', async () => {
      const adminToken = await createAdminAndLogin();
      await createCategory({ name: 'Du lịch biển' });
      await createCategory({ name: 'Du lịch núi' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/categories')
        .query({ search: 'biển' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as CategoryListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].name).toBe('Du lịch biển');
    });
  });

  describe('PATCH /api/v1/admin/categories/:categoryId', () => {
    it('returns 404 for a category that does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/admin/categories/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Du lịch biển đảo', description: 'Mới' })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('CATEGORY_NOT_FOUND');
    });

    it('returns 409 when renaming to an existing name', async () => {
      const adminToken = await createAdminAndLogin();
      await createCategory({ name: 'Du lịch biển' });
      const target = await createCategory({ name: 'Du lịch núi' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Du lịch biển', description: 'Mới' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('CATEGORY_NAME_EXISTS');
    });

    it('updates the category', async () => {
      const adminToken = await createAdminAndLogin();
      const target = await createCategory();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Du lịch biển đảo', description: 'Mới' })
        .expect(200);

      const body = res.body as CategoryBody;
      expect(body).toMatchObject({ id: target.id, name: 'Du lịch biển đảo' });

      const updated = await dataSource
        .getRepository(Category)
        .findOne({ where: { id: target.id } });
      expect(updated?.description).toBe('Mới');
    });
  });

  describe('DELETE /api/v1/admin/categories/:categoryId', () => {
    it('returns 404 for a category that does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      await request(app.getHttpServer())
        .delete('/api/v1/admin/categories/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('deletes the category and sets related tours.category_id to NULL', async () => {
      const adminToken = await createAdminAndLogin();
      const target = await createCategory();
      const toursRepository = dataSource.getRepository(Tour);
      const tour = await toursRepository.save(
        toursRepository.create({ categoryId: target.id }),
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/categories/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const reloadedTour = await toursRepository.findOne({
        where: { id: tour.id },
      });
      expect(reloadedTour?.categoryId).toBeNull();
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
