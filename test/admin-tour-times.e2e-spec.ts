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
import { TourTimeStatus } from './../src/tours/tour-time-status.enum';
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

interface TourTimeBody {
  id: number;
  startDate?: string;
  endDate?: string;
  price: number;
  maxCapacity: number;
  bookedSlots?: number;
  status: string;
}

interface TourTimeListBody {
  items: TourTimeBody[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

describe('Admin tour times (e2e)', () => {
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
    customerId = undefined;
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

  async function createTourTime(
    tourId: number,
    overrides: Partial<TourTime> = {},
  ): Promise<TourTime> {
    const tourTimesRepository = dataSource.getRepository(TourTime);
    const tourTime = tourTimesRepository.create({
      tourId,
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      price: 3500000,
      maxCapacity: 20,
      ...overrides,
    });
    return tourTimesRepository.save(tourTime);
  }

  let customerId: number | undefined;

  async function getOrCreateCustomerId(): Promise<number> {
    if (customerId !== undefined) return customerId;
    const usersRepository = dataSource.getRepository(User);
    const customer = await usersRepository.save(
      usersRepository.create({
        email: 'customer@example.com',
        password: await bcrypt.hash(password, 10),
        fullName: 'Customer',
        phone: '0911111111',
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      }),
    );
    customerId = customer.id;
    return customerId;
  }

  async function createBooking(
    tourTimeId: number,
    numberOfSlots: number,
    status: BookingStatus = BookingStatus.CONFIRMED,
  ): Promise<Booking> {
    const bookingsRepository = dataSource.getRepository(Booking);
    const userId = await getOrCreateCustomerId();
    return bookingsRepository.save(
      bookingsRepository.create({
        tourTimeId,
        userId,
        numberOfSlots,
        totalPrice: 0,
        status,
      }),
    );
  }

  describe('POST /api/v1/admin/tours/:tourId/times', () => {
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
        .post('/api/v1/admin/tours/1/times')
        .set(
          'Authorization',
          `Bearer ${(loginRes.body as LoginBody).accessToken}`,
        )
        .send({
          startDate: '2026-10-01',
          endDate: '2026-10-03',
          price: 3500000,
          maxCapacity: 20,
        })
        .expect(403);
    });

    it('returns 400 when startDate is not before endDate', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/times`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startDate: '2026-10-05',
          endDate: '2026-10-03',
          price: 3500000,
          maxCapacity: 20,
        })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('INVALID_DATE_RANGE');
    });

    it('returns 404 when the tour does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/tours/999999/times')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startDate: '2026-10-01',
          endDate: '2026-10-03',
          price: 3500000,
          maxCapacity: 20,
        })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_NOT_FOUND');
    });

    it('creates a tour time with open status', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/tours/${tour.id}/times`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startDate: '2026-10-01',
          endDate: '2026-10-03',
          price: 3500000,
          maxCapacity: 20,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        price: 3500000,
        maxCapacity: 20,
        status: 'open',
      });
    });
  });

  describe('GET /api/v1/admin/tours/:tourId/times', () => {
    it('computes bookedSlots from pending/confirmed bookings only', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      await createBooking(tourTime.id, 3, BookingStatus.CONFIRMED);
      await createBooking(tourTime.id, 2, BookingStatus.PENDING);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tours/${tour.id}/times`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as TourTimeListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].bookedSlots).toBe(5);
      // Regression check: a raw query returning a `date` column as a JS Date
      // can shift it by a day once serialized, depending on server timezone.
      expect(body.items[0].startDate).toBe('2026-10-01');
    });

    it('filters by status', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      await createTourTime(tour.id, { status: TourTimeStatus.OPEN });
      await createTourTime(tour.id, { status: TourTimeStatus.CANCELLED });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/tours/${tour.id}/times`)
        .query({ status: 'cancelled' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as TourTimeListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].status).toBe('cancelled');
    });
  });

  describe('PATCH /api/v1/admin/tours/:tourId/times/:timeId', () => {
    it('returns 404 when the tour time does not exist', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}/times/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 4000000, maxCapacity: 25, status: 'open' })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_TIME_NOT_FOUND');
    });

    it('returns 409 when lowering capacity below booked slots', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id, { maxCapacity: 20 });
      await createBooking(tourTime.id, 15, BookingStatus.CONFIRMED);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}/times/${tourTime.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 3500000, maxCapacity: 10, status: 'open' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('CAPACITY_BELOW_BOOKED');
    });

    it('updates price, capacity and status', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/tours/${tour.id}/times/${tourTime.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 3900000, maxCapacity: 25, status: 'open' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: tourTime.id,
        price: 3900000,
        maxCapacity: 25,
        status: 'open',
      });
    });
  });

  describe('DELETE /api/v1/admin/tours/:tourId/times/:timeId', () => {
    it('returns 404 when the tour time does not exist', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}/times/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns 409 when the tour time still has a booking', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      await createBooking(tourTime.id, 2, BookingStatus.CONFIRMED);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}/times/${tourTime.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('TOUR_TIME_HAS_BOOKING');
    });

    it('deletes a tour time with no bookings', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/tours/${tour.id}/times/${tourTime.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
