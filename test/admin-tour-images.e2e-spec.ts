import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PUBLIC_DIR } from './../src/common/public-dir';
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

const FAKE_JPEG = Buffer.from('fake-image-content');

describe('Admin tour images (e2e)', () => {
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
        .attach('file', FAKE_JPEG, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        })
        .field('sortOrder', 0)
        .expect(403);
    });

    it('returns 404 when the tour does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/tours/999999/images')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', FAKE_JPEG, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        })
        .field('sortOrder', 0)
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_NOT_FOUND');

      // The file is written by Multer before the handler runs — the
      // not-found path must still clean it up, not just the DB-error path.
      const files = readdirSync(join(PUBLIC_DIR, 'uploads/tours'));
      expect(files.filter((f) => f !== '.gitkeep')).toHaveLength(0);
    });

    it('rejects a request with no file attached', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('sortOrder', 0)
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it('rejects a disallowed file type', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('not an image'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .field('sortOrder', 0)
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');

      // The mime-type check runs as a pipe, after Multer has already
      // written the file but before the handler's own try/catch — must
      // still be cleaned up, not left orphaned on disk.
      const files = readdirSync(join(PUBLIC_DIR, 'uploads/tours'));
      expect(files.filter((f) => f !== '.gitkeep')).toHaveLength(0);
    });

    it('rejects an oversized file', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const oversized = Buffer.alloc(6 * 1024 * 1024);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', oversized, {
          filename: 'big.jpg',
          contentType: 'image/jpeg',
        })
        .field('sortOrder', 0)
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it('uploads the file to disk and returns its served URL', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', FAKE_JPEG, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        })
        .field('sortOrder', 0)
        .expect(201);

      const body = res.body as ImageBody;
      expect(body.sortOrder).toBe(0);
      expect(body.imageUrl).toMatch(/^\/uploads\/tours\/.+\.jpg$/);
      expect(existsSync(join(PUBLIC_DIR, body.imageUrl!))).toBe(true);

      const staticRes = await request(app.getHttpServer()).get(body.imageUrl!);
      expect(staticRes.status).toBe(200);
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
          imageUrl: '/uploads/tours/second.jpg',
          sortOrder: 1,
        }),
        imagesRepository.create({
          tourId: tour.id,
          imageUrl: '/uploads/tours/first.jpg',
          sortOrder: 0,
        }),
      ]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as ImageListBody;
      expect(body.items.map((item) => item.imageUrl)).toEqual([
        '/uploads/tours/first.jpg',
        '/uploads/tours/second.jpg',
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
          imageUrl: '/uploads/tours/a.jpg',
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
          imageUrl: '/uploads/tours/a.jpg',
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

    it('deletes the image record and its file on disk', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', FAKE_JPEG, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        })
        .field('sortOrder', 0)
        .expect(201);
      const { id, imageUrl } = createRes.body as ImageBody;
      const filePath = join(PUBLIC_DIR, imageUrl!);
      expect(existsSync(filePath)).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}/images/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe('GET /api/v1/admin/tours/:tourId detail includes real images', () => {
    it('returns the images added via the images endpoints', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      await dataSource.getRepository(TourImage).save(
        dataSource.getRepository(TourImage).create({
          tourId: tour.id,
          imageUrl: '/uploads/tours/a.jpg',
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
        imageUrl: '/uploads/tours/a.jpg',
        sortOrder: 0,
      });
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
