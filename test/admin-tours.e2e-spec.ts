import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { Category } from './../src/categories/category.entity';
import { configureApp } from './../src/configure-app';
import { TourStatus } from './../src/tours/tour-status.enum';
import { TourTime } from './../src/tours/tour-time.entity';
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

interface TourBody {
  id: number;
  categoryId?: number;
  title: string;
  status?: string;
}

interface TourListBody {
  items: {
    id: number;
    title: string;
    categoryName: string | null;
    status: string;
    timesCount: number;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface TourDetailBody {
  id: number;
  category: { id: number; name: string } | null;
  title: string;
  description: string;
  status: string;
  images: unknown[];
}

describe('Admin tours (e2e)', () => {
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

  async function createTour(overrides: Partial<Tour> = {}): Promise<Tour> {
    const toursRepository = dataSource.getRepository(Tour);
    const tour = toursRepository.create({
      title: 'Đà Nẵng - Hội An',
      description: 'Tour 3 ngày 2 đêm',
      ...overrides,
    });
    return toursRepository.save(tour);
  }

  async function createTourTime(tourId: number): Promise<TourTime> {
    const tourTimesRepository = dataSource.getRepository(TourTime);
    const tourTime = tourTimesRepository.create({
      tourId,
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      price: 3500000,
      maxCapacity: 20,
    });
    return tourTimesRepository.save(tourTime);
  }

  describe('POST /api/v1/admin/tours', () => {
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
        .post('/api/v1/admin/tours')
        .set(
          'Authorization',
          `Bearer ${(loginRes.body as LoginBody).accessToken}`,
        )
        .send({ categoryId: 1, title: 'Đà Nẵng', description: '...' })
        .expect(403);
    });

    it('returns 404 when the category does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/tours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoryId: 999999, title: 'Đà Nẵng', description: '...' })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('CATEGORY_NOT_FOUND');
    });

    it('creates a tour with draft status', async () => {
      const adminToken = await createAdminAndLogin();
      const category = await createCategory();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/tours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: category.id,
          title: 'Đà Nẵng - Hội An',
          description: 'Tour 3 ngày 2 đêm',
        })
        .expect(201);

      const body = res.body as TourBody;
      expect(body).toMatchObject({
        categoryId: category.id,
        title: 'Đà Nẵng - Hội An',
        status: 'draft',
      });
    });
  });

  describe('GET /api/v1/admin/tours', () => {
    it('lists tours with categoryName and timesCount', async () => {
      const adminToken = await createAdminAndLogin();
      const category = await createCategory();
      const tour = await createTour({
        categoryId: category.id,
        title: 'Có lịch',
      });
      await createTour({ title: 'Chưa có lịch' });

      await createTourTime(tour.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/tours')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as TourListBody;
      expect(body.pagination.total).toBe(2);
      const withSchedule = body.items.find((item) => item.title === 'Có lịch');
      const withoutSchedule = body.items.find(
        (item) => item.title === 'Chưa có lịch',
      );
      expect(withSchedule).toMatchObject({
        categoryName: 'Du lịch biển',
        timesCount: 1,
      });
      expect(withoutSchedule).toMatchObject({
        categoryName: null,
        timesCount: 0,
      });
    });

    it('filters by status', async () => {
      const adminToken = await createAdminAndLogin();
      await createTour({ title: 'Draft tour' });
      const tour = await createTour({ title: 'Published tour' });
      await createTourTime(tour.id);
      await dataSource
        .getRepository(Tour)
        .update(tour.id, { status: TourStatus.PUBLISHED });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/tours')
        .query({ status: 'published' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as TourListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe('Published tour');
    });

    it('filters by categoryId', async () => {
      const adminToken = await createAdminAndLogin();
      const bienCategory = await createCategory({ name: 'Du lịch biển' });
      const nuiCategory = await createCategory({ name: 'Du lịch núi' });
      await createTour({ categoryId: bienCategory.id, title: 'Tour biển' });
      await createTour({ categoryId: nuiCategory.id, title: 'Tour núi' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/tours')
        .query({ categoryId: bienCategory.id })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as TourListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe('Tour biển');
    });
  });

  describe('GET /api/v1/admin/tours/:tourId', () => {
    it('returns 404 for a tour that does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      await request(app.getHttpServer())
        .get('/api/v1/admin/tours/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns the full tour detail', async () => {
      const adminToken = await createAdminAndLogin();
      const category = await createCategory();
      const tour = await createTour({ categoryId: category.id });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tours/${tour.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as TourDetailBody;
      expect(body).toMatchObject({
        id: tour.id,
        category: { id: category.id, name: 'Du lịch biển' },
        title: 'Đà Nẵng - Hội An',
        status: 'draft',
        images: [],
      });
    });

    it('returns category: null for a tour whose category was deleted', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour({ categoryId: null });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tours/${tour.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as TourDetailBody;
      expect(body.category).toBeNull();
    });
  });

  describe('PATCH /api/v1/admin/tours/:tourId', () => {
    it('returns 404 when the tour does not exist', async () => {
      const adminToken = await createAdminAndLogin();
      const category = await createCategory();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/admin/tours/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoryId: category.id, title: 'Mới', description: 'Mới' })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_OR_CATEGORY_NOT_FOUND');
    });

    it('returns 404 when the category does not exist', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoryId: 999999, title: 'Mới', description: 'Mới' })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_OR_CATEGORY_NOT_FOUND');
    });

    it('updates the tour', async () => {
      const adminToken = await createAdminAndLogin();
      const category = await createCategory();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: category.id,
          title: 'Đà Nẵng - Hội An - Bà Nà',
          description: 'Mới',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: tour.id,
        title: 'Đà Nẵng - Hội An - Bà Nà',
      });
    });
  });

  describe('PATCH /api/v1/admin/tours/:tourId/status', () => {
    it('returns 409 when publishing a tour with no tour times', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'published' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('TOUR_HAS_NO_TOUR_TIME');
    });

    it('publishes a tour that has a tour time', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      await createTourTime(tour.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'published' })
        .expect(200);

      expect(res.body).toMatchObject({ id: tour.id, status: 'published' });
    });
  });

  describe('DELETE /api/v1/admin/tours/:tourId', () => {
    it('returns 404 for a tour that does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      await request(app.getHttpServer())
        .delete('/api/v1/admin/tours/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns 409 when the tour still has tour times', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      await createTourTime(tour.id);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('TOUR_HAS_TOUR_TIMES');
    });

    it('deletes a tour with no tour times', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
