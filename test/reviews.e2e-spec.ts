import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { BookingStatus } from './../src/bookings/booking-status.enum';
import { Booking } from './../src/bookings/booking.entity';
import { configureApp } from './../src/configure-app';
import { Review } from './../src/reviews/review.entity';
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

interface CreateReviewBody {
  id: number;
  bookingId: number;
  rating: number;
  comment: string;
  status: string;
  createdAt: string;
}

describe('Reviews (e2e)', () => {
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

  async function createCustomerAndLogin(
    email = 'customer@example.com',
  ): Promise<{ user: User; accessToken: string }> {
    const usersRepository = dataSource.getRepository(User);
    const user = await usersRepository.save(
      usersRepository.create({
        email,
        password: await bcrypt.hash(password, 10),
        fullName: 'Customer',
        phone: '0911111111',
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      }),
    );
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return { user, accessToken: (res.body as LoginBody).accessToken };
  }

  async function createTour(): Promise<Tour> {
    const toursRepository = dataSource.getRepository(Tour);
    return toursRepository.save(
      toursRepository.create({
        title: 'Đà Nẵng - Hội An',
        description: 'Tour 3 ngày 2 đêm',
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
    status: BookingStatus = BookingStatus.COMPLETED,
  ): Promise<Booking> {
    const bookingsRepository = dataSource.getRepository(Booking);
    return bookingsRepository.save(
      bookingsRepository.create({
        tourTimeId,
        userId,
        numberOfSlots: 2,
        totalPrice: 7000000,
        status,
      }),
    );
  }

  describe('POST /api/v1/bookings/:bookingId/review', () => {
    it('returns 404 when the booking does not belong to the current user', async () => {
      const { accessToken } = await createCustomerAndLogin();
      const other = await createCustomerAndLogin('other@example.com');
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, other.user.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ rating: 5, comment: 'Tuyệt vời' })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('BOOKING_NOT_FOUND');
    });

    it('returns 409 when the booking is not completed', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(
        tourTime.id,
        user.id,
        BookingStatus.CONFIRMED,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ rating: 5, comment: 'Tuyệt vời' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('BOOKING_NOT_COMPLETED');
    });

    it('returns 400 VALIDATION_ERROR for an out-of-range rating', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, user.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ rating: 6, comment: 'Tuyệt vời' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it('creates a pending review for a completed booking', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, user.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ rating: 5, comment: 'Tour rất tuyệt vời' })
        .expect(201);

      const body = res.body as CreateReviewBody;
      expect(body).toMatchObject({
        bookingId: booking.id,
        rating: 5,
        comment: 'Tour rất tuyệt vời',
        status: 'pending',
      });
    });

    it('returns 409 when a review already exists for the booking', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, user.id);
      await dataSource.getRepository(Review).save(
        dataSource.getRepository(Review).create({
          bookingId: booking.id,
          rating: 4,
          comment: 'Đã có review',
        }),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ rating: 5, comment: 'Tour rất tuyệt vời' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('REVIEW_ALREADY_EXISTS');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
