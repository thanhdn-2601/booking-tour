import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { ActorType } from './../src/bookings/actor-type.enum';
import { BookingStatusHistory } from './../src/bookings/booking-status-history.entity';
import { BookingStatus } from './../src/bookings/booking-status.enum';
import { Booking } from './../src/bookings/booking.entity';
import { configureApp } from './../src/configure-app';
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

interface BookingListItemBody {
  id: number;
  userEmail: string;
  tourTitle: string;
  status: string;
  totalPrice: number;
}

interface BookingListBody {
  items: BookingListItemBody[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BookingDetailBody {
  id: number;
  user: { id: number; email: string };
  tourTime: { id: number; startDate: string };
  status: string;
  totalPrice: number;
  history: {
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorType: string;
    createdAt: string;
  }[];
}

interface UpdateStatusBody {
  id: number;
  status: string;
  updatedAt: string;
}

describe('Admin bookings (e2e)', () => {
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

  async function createBooking(
    tourTimeId: number,
    userId: number,
    overrides: Partial<Booking> = {},
  ): Promise<Booking> {
    const bookingsRepository = dataSource.getRepository(Booking);
    const booking = bookingsRepository.create({
      tourTimeId,
      userId,
      numberOfSlots: 2,
      totalPrice: 7000000,
      status: BookingStatus.PENDING,
      ...overrides,
    });
    const saved = await bookingsRepository.save(booking);
    await dataSource.getRepository(BookingStatusHistory).save(
      dataSource.getRepository(BookingStatusHistory).create({
        bookingId: saved.id,
        fromStatus: null,
        toStatus: saved.status,
        reason: null,
        actorType: ActorType.USER,
      }),
    );
    return saved;
  }

  describe('GET /api/v1/admin/bookings', () => {
    it('rejects a non-admin user', async () => {
      const customer = await createCustomer();
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set(
          'Authorization',
          `Bearer ${(loginRes.body as LoginBody).accessToken}`,
        )
        .expect(403);
    });

    it('lists bookings with userEmail, tourTitle, status, totalPrice', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      await createBooking(tourTime.id, customer.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as BookingListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        userEmail: customer.email,
        tourTitle: 'Đà Nẵng - Hội An',
        status: 'pending',
        totalPrice: 7000000,
      });
    });

    it('filters by status', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      await createBooking(tourTime.id, customer.id, {
        status: BookingStatus.PENDING,
      });
      await createBooking(tourTime.id, customer.id, {
        status: BookingStatus.REJECTED,
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .query({ status: 'rejected' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as BookingListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].status).toBe('rejected');
    });

    it('filters by tourId', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tourA = await createTour({ title: 'Tour A' });
      const tourB = await createTour({ title: 'Tour B' });
      const tourTimeA = await createTourTime(tourA.id);
      const tourTimeB = await createTourTime(tourB.id);
      await createBooking(tourTimeA.id, customer.id);
      await createBooking(tourTimeB.id, customer.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .query({ tourId: tourA.id })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as BookingListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].tourTitle).toBe('Tour A');
    });
  });

  describe('GET /api/v1/admin/bookings/:bookingId', () => {
    it('returns 404 when the booking does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('BOOKING_NOT_FOUND');
    });

    it('returns the booking detail with user, tourTime, and history', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as BookingDetailBody;
      expect(body).toMatchObject({
        id: booking.id,
        user: { id: customer.id, email: customer.email },
        tourTime: { id: tourTime.id, startDate: '2026-10-01' },
        status: 'pending',
        totalPrice: 7000000,
      });
      expect(body.history).toHaveLength(1);
      expect(body.history[0]).toMatchObject({
        fromStatus: null,
        toStatus: 'pending',
        actorType: 'user',
      });
    });
  });

  describe('POST /api/v1/admin/bookings/:bookingId/approve', () => {
    it('returns 404 when the booking does not exist', async () => {
      const adminToken = await createAdminAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/bookings/999999/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('BOOKING_NOT_FOUND');
    });

    it('returns 409 when the booking is not pending', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id, {
        status: BookingStatus.REJECTED,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${booking.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('INVALID_BOOKING_TRANSITION');
    });

    it('returns 409 when approving would exceed capacity', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id, { maxCapacity: 5 });
      // Already-confirmed bookings fill the tour time to capacity.
      await createBooking(tourTime.id, customer.id, {
        numberOfSlots: 5,
        status: BookingStatus.CONFIRMED,
      });
      const pending = await createBooking(tourTime.id, customer.id, {
        numberOfSlots: 1,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${pending.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('NOT_ENOUGH_SLOTS');
    });

    it('approves a pending booking within capacity', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id, { maxCapacity: 20 });
      const booking = await createBooking(tourTime.id, customer.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${booking.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body as UpdateStatusBody).toMatchObject({
        id: booking.id,
        status: 'confirmed',
      });

      const history = await dataSource
        .getRepository(BookingStatusHistory)
        .find({
          where: { bookingId: booking.id },
          order: { createdAt: 'ASC' },
        });
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({
        fromStatus: 'pending',
        toStatus: 'confirmed',
        actorType: 'admin',
      });
    });
  });

  describe('POST /api/v1/admin/bookings/:bookingId/reject', () => {
    it('returns 400 REASON_REQUIRED when reason is missing', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${booking.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('REASON_REQUIRED');
    });

    it('returns 409 when the booking is not pending', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id, {
        status: BookingStatus.CONFIRMED,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${booking.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Tour đã hết chỗ' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('INVALID_BOOKING_TRANSITION');
    });

    it('rejects a pending booking with a reason', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${booking.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Tour đã hết chỗ' })
        .expect(200);

      expect(res.body as UpdateStatusBody).toMatchObject({
        id: booking.id,
        status: 'rejected',
      });

      const history = await dataSource
        .getRepository(BookingStatusHistory)
        .find({
          where: { bookingId: booking.id },
          order: { createdAt: 'ASC' },
        });
      expect(history[1]).toMatchObject({
        toStatus: 'rejected',
        reason: 'Tour đã hết chỗ',
        actorType: 'admin',
      });
    });
  });

  describe('POST /api/v1/admin/bookings/:bookingId/cancel', () => {
    it('cancels a confirmed booking with a reason', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id, {
        status: BookingStatus.CONFIRMED,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Tour bị hủy do thời tiết' })
        .expect(200);

      expect(res.body as UpdateStatusBody).toMatchObject({
        id: booking.id,
        status: 'cancelled_by_admin',
      });
    });

    it('returns 409 when the booking is already cancelled', async () => {
      const adminToken = await createAdminAndLogin();
      const customer = await createCustomer();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, customer.id, {
        status: BookingStatus.CANCELLED_BY_ADMIN,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Tour bị hủy do thời tiết' })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('INVALID_BOOKING_TRANSITION');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
