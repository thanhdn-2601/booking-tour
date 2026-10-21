import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { Booking } from './../src/bookings/booking.entity';
import { BookingStatus } from './../src/bookings/booking-status.enum';
import { configureApp } from './../src/configure-app';
import { Review } from './../src/reviews/review.entity';
import { ReviewStatus } from './../src/reviews/review-status.enum';
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

interface ReviewListItemBody {
  id: number;
  tourId: number;
  userEmail: string;
  rating: number;
  status: string;
}

interface ReviewListBody {
  items: ReviewListItemBody[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface UpdateStatusBody {
  id: number;
  status: string;
  updatedAt: string;
}

describe('Admin reviews (e2e)', () => {
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

  async function createCustomer(email = 'customer@example.com'): Promise<User> {
    const usersRepository = dataSource.getRepository(User);
    return usersRepository.save(
      usersRepository.create({
        email,
        password: await bcrypt.hash(password, 10),
        fullName: 'Customer',
        phone: '0911111111',
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      }),
    );
  }

  async function createTour(overrides: Partial<Tour> = {}): Promise<Tour> {
    const toursRepository = dataSource.getRepository(Tour);
    return toursRepository.save(
      toursRepository.create({
        title: 'Đà Nẵng - Hội An',
        description: 'Tour 3 ngày 2 đêm',
        ...overrides,
      }),
    );
  }

  async function createTourTime(tourId: number): Promise<TourTime> {
    const tourTimesRepository = dataSource.getRepository(TourTime);
    return tourTimesRepository.save(
      tourTimesRepository.create({
        tourId,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        price: 3500000,
        maxCapacity: 20,
      }),
    );
  }

  async function createBooking(
    tourTimeId: number,
    userId: number,
  ): Promise<Booking> {
    const bookingsRepository = dataSource.getRepository(Booking);
    return bookingsRepository.save(
      bookingsRepository.create({
        tourTimeId,
        userId,
        numberOfSlots: 2,
        totalPrice: 7000000,
        status: BookingStatus.COMPLETED,
      }),
    );
  }

  async function createReview(
    bookingId: number,
    overrides: Partial<Review> = {},
  ): Promise<Review> {
    const reviewsRepository = dataSource.getRepository(Review);
    return reviewsRepository.save(
      reviewsRepository.create({
        bookingId,
        rating: 5,
        comment: 'Tour rất tuyệt vời',
        status: ReviewStatus.PENDING,
        ...overrides,
      }),
    );
  }

  describe('GET /api/v1/admin/reviews', () => {
    it('rejects a non-admin user', async () => {
      const customer = await createCustomer();
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/admin/reviews')
        .set(
          'Authorization',
          `Bearer ${(loginRes.body as LoginBody).accessToken}`,
        )
        .expect(403);
    });

    it('lists reviews with tourId, userEmail, rating, status', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);
      await createReview(booking.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reviews')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as ReviewListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        tourId: tour.id,
        userEmail: customer.email,
        rating: 5,
        status: 'pending',
      });
    });

    it('filters by status and tourId', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tourA = await createTour({ title: 'Tour A' });
      const tourB = await createTour({ title: 'Tour B' });
      const tourTimeA = await createTourTime(tourA.id);
      const tourTimeB = await createTourTime(tourB.id);
      const bookingA = await createBooking(tourTimeA.id, customer.id);
      const bookingB = await createBooking(tourTimeB.id, customer.id);
      await createReview(bookingA.id, { status: ReviewStatus.APPROVED });
      await createReview(bookingB.id, { status: ReviewStatus.PENDING });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reviews')
        .query({ status: 'approved', tourId: tourA.id })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as ReviewListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].tourId).toBe(tourA.id);
    });
  });

  describe('POST /api/v1/admin/reviews/:reviewId/approve', () => {
    it('returns 404 when the review does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/reviews/999999/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('REVIEW_NOT_FOUND');
    });

    it('returns 409 when the review is not pending', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);
      const review = await createReview(booking.id, {
        status: ReviewStatus.APPROVED,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/reviews/${review.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('INVALID_REVIEW_TRANSITION');
    });

    it('approves a pending review', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);
      const review = await createReview(booking.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/reviews/${review.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body as UpdateStatusBody).toMatchObject({
        id: review.id,
        status: 'approved',
      });
    });
  });

  describe('POST /api/v1/admin/reviews/:reviewId/reject', () => {
    it('returns 400 VALIDATION_ERROR when reason is missing', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);
      const review = await createReview(booking.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/reviews/${review.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it('rejects a pending review with a reason', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);
      const review = await createReview(booking.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/reviews/${review.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Nội dung không phù hợp' })
        .expect(200);

      expect(res.body as UpdateStatusBody).toMatchObject({
        id: review.id,
        status: 'rejected',
      });
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
