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

interface CreateBookingBody {
  id: number;
  tourTimeId: number;
  numberOfSlots: number;
  status: string;
  totalPrice: number;
  createdAt: string;
}

interface BookingListItemBody {
  id: number;
  tourTitle: string;
  startDate: string;
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
  tourTime: { id: number; startDate: string; endDate: string };
  numberOfSlots: number;
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

describe('Bookings (e2e)', () => {
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
      status: TourTimeStatus.OPEN,
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

  describe('POST /api/v1/bookings', () => {
    it('rejects an admin user', async () => {
      const adminToken = await createAdminAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);

      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tourTimeId: tourTime.id, numberOfSlots: 2 })
        .expect(403);
    });

    it('returns 404 when the tour time does not exist', async () => {
      const { accessToken } = await createCustomerAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tourTimeId: 999999, numberOfSlots: 2 })
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_TIME_NOT_FOUND');
    });

    it('returns 409 when the tour time is not open', async () => {
      const { accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id, {
        status: TourTimeStatus.CANCELLED,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tourTimeId: tourTime.id, numberOfSlots: 2 })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('TOUR_TIME_NOT_OPEN');
    });

    it('returns 409 when there are not enough slots', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id, { maxCapacity: 5 });
      await createBooking(tourTime.id, user.id, {
        numberOfSlots: 5,
        status: BookingStatus.CONFIRMED,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tourTimeId: tourTime.id, numberOfSlots: 1 })
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('NOT_ENOUGH_SLOTS');
    });

    it('creates a pending booking within capacity', async () => {
      const { accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id, {
        price: 3500000,
        maxCapacity: 20,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tourTimeId: tourTime.id, numberOfSlots: 2 })
        .expect(201);

      const body = res.body as CreateBookingBody;
      expect(body).toMatchObject({
        tourTimeId: tourTime.id,
        numberOfSlots: 2,
        status: 'pending',
        totalPrice: 7000000,
      });

      const history = await dataSource
        .getRepository(BookingStatusHistory)
        .find({
          where: { bookingId: body.id },
        });
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        fromStatus: null,
        toStatus: 'pending',
        actorType: 'user',
      });
    });
  });

  describe('GET /api/v1/bookings', () => {
    it('only lists bookings owned by the current user', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const other = await createCustomerAndLogin('other@example.com');
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      await createBooking(tourTime.id, user.id);
      await createBooking(tourTime.id, other.user.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as BookingListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        tourTitle: 'Đà Nẵng - Hội An',
        startDate: '2026-10-01',
        status: 'pending',
        totalPrice: 7000000,
      });
    });

    it('filters by status', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      await createBooking(tourTime.id, user.id, {
        status: BookingStatus.PENDING,
      });
      await createBooking(tourTime.id, user.id, {
        status: BookingStatus.CANCELLED_BY_USER,
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .query({ status: 'cancelled_by_user' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as BookingListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].status).toBe('cancelled_by_user');
    });
  });

  describe('GET /api/v1/bookings/:bookingId', () => {
    it('returns 404 when the booking does not belong to the current user', async () => {
      const { accessToken } = await createCustomerAndLogin();
      const other = await createCustomerAndLogin('other@example.com');
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, other.user.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('BOOKING_NOT_FOUND');
    });

    it('returns the booking detail with history', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, user.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as BookingDetailBody;
      expect(body).toMatchObject({
        id: booking.id,
        tourTime: {
          id: tourTime.id,
          startDate: '2026-10-01',
          endDate: '2026-10-03',
        },
        numberOfSlots: 2,
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

  describe('POST /api/v1/bookings/:bookingId/cancel', () => {
    it('returns 404 when the booking does not belong to the current user', async () => {
      const { accessToken } = await createCustomerAndLogin();
      const other = await createCustomerAndLogin('other@example.com');
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, other.user.id);

      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('cancels a pending booking', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, user.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body as UpdateStatusBody).toMatchObject({
        id: booking.id,
        status: 'cancelled_by_user',
      });

      const history = await dataSource
        .getRepository(BookingStatusHistory)
        .find({
          where: { bookingId: booking.id },
          order: { createdAt: 'ASC' },
        });
      expect(history[1]).toMatchObject({
        fromStatus: 'pending',
        toStatus: 'cancelled_by_user',
        actorType: 'user',
      });
    });

    it('returns 409 when the booking is already confirmed', async () => {
      const { user, accessToken } = await createCustomerAndLogin();
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const booking = await createBooking(tourTime.id, user.id, {
        status: BookingStatus.CONFIRMED,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      expect((res.body as ErrorBody).code).toBe('BOOKING_CANNOT_BE_CANCELLED');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
