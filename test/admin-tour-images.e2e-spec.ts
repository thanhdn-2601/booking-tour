import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { TourImage } from './../src/tours/tour-image.entity';
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

interface ImageBody {
  id: number;
  imageUrl?: string;
  sortOrder: number;
}

interface ImageListBody {
  items: ImageBody[];
}

describe('Admin tour images (e2e)', () => {
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

  async function createTour(overrides: Partial<Tour> = {}): Promise<Tour> {
    const toursRepository = dataSource.getRepository(Tour);
    const tour = toursRepository.create({
      title: 'Đà Nẵng - Hội An',
      description: 'Tour 3 ngày 2 đêm',
      ...overrides,
    });
    return toursRepository.save(tour);
  }

  describe('POST /api/v1/admin/tours/:tourId/images', () => {
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
        .post('/api/v1/admin/tours/1/images')
        .set(
          'Authorization',
          `Bearer ${(loginRes.body as LoginBody).accessToken}`,
        )
        .send({ imageUrl: 'https://cdn.example.com/a.jpg', sortOrder: 0 })
        .expect(403);
    });

    it('returns 404 when the tour does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/tours/999999/images')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: 'https://cdn.example.com/a.jpg', sortOrder: 0 })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_NOT_FOUND');
    });

    it('rejects an invalid image URL', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: 'not-a-url', sortOrder: 0 })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it('adds an image to the tour', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: 'https://cdn.example.com/a.jpg', sortOrder: 0 })
        .expect(201);

      expect(res.body).toMatchObject({
        imageUrl: 'https://cdn.example.com/a.jpg',
        sortOrder: 0,
      });
    });
  });

  describe('GET /api/v1/admin/tours/:tourId/images', () => {
    it('returns 404 when the tour does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      await request(app.getHttpServer())
        .get('/api/v1/admin/tours/999999/images')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('lists images ordered by sortOrder ascending', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const imagesRepository = dataSource.getRepository(TourImage);
      await imagesRepository.save([
        imagesRepository.create({
          tourId: tour.id,
          imageUrl: 'https://cdn.example.com/second.jpg',
          sortOrder: 1,
        }),
        imagesRepository.create({
          tourId: tour.id,
          imageUrl: 'https://cdn.example.com/first.jpg',
          sortOrder: 0,
        }),
      ]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as ImageListBody;
      expect(body.items.map((item) => item.imageUrl)).toEqual([
        'https://cdn.example.com/first.jpg',
        'https://cdn.example.com/second.jpg',
      ]);
    });
  });

  describe('PATCH /api/v1/admin/tours/:tourId/images/:imageId', () => {
    it('returns 404 when the image does not belong to the tour', async () => {
      const adminToken = await createAdminAndLogin();
      const tourA = await createTour({ title: 'Tour A' });
      const tourB = await createTour({ title: 'Tour B' });
      const image = await dataSource.getRepository(TourImage).save(
        dataSource.getRepository(TourImage).create({
          tourId: tourA.id,
          imageUrl: 'https://cdn.example.com/a.jpg',
          sortOrder: 0,
        }),
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tourB.id}/images/${image.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sortOrder: 5 })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_OR_IMAGE_NOT_FOUND');
    });

    it('updates the sort order', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const image = await dataSource.getRepository(TourImage).save(
        dataSource.getRepository(TourImage).create({
          tourId: tour.id,
          imageUrl: 'https://cdn.example.com/a.jpg',
          sortOrder: 0,
        }),
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}/images/${image.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sortOrder: 5 })
        .expect(200);

      expect(res.body).toMatchObject({ id: image.id, sortOrder: 5 });
    });
  });

  describe('DELETE /api/v1/admin/tours/:tourId/images/:imageId', () => {
    it('returns 404 when the image does not exist', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}/images/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('deletes the image', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const image = await dataSource.getRepository(TourImage).save(
        dataSource.getRepository(TourImage).create({
          tourId: tour.id,
          imageUrl: 'https://cdn.example.com/a.jpg',
          sortOrder: 0,
        }),
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}/images/${image.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  describe('GET /api/v1/admin/tours/:tourId detail includes real images', () => {
    it('returns the images added via the images endpoints', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      await dataSource.getRepository(TourImage).save(
        dataSource.getRepository(TourImage).create({
          tourId: tour.id,
          imageUrl: 'https://cdn.example.com/a.jpg',
          sortOrder: 0,
        }),
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tours/${tour.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as { images: ImageBody[] };
      expect(body.images).toHaveLength(1);
      expect(body.images[0]).toMatchObject({
        imageUrl: 'https://cdn.example.com/a.jpg',
        sortOrder: 0,
      });
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
