import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { Booking } from './../src/bookings/booking.entity';
import { BookingStatus } from './../src/bookings/booking-status.enum';
import { Category } from './../src/categories/category.entity';
import { configureApp } from './../src/configure-app';
import { Review } from './../src/reviews/review.entity';
import { ReviewStatus } from './../src/reviews/review-status.enum';
import { TourImage } from './../src/tours/tour-image.entity';
import { TourStatus } from './../src/tours/tour-status.enum';
import { TourTimeStatus } from './../src/tours/tour-time-status.enum';
import { TourTime } from './../src/tours/tour-time.entity';
import { Tour } from './../src/tours/tour.entity';
import { User } from './../src/users/user.entity';
import { UserRole } from './../src/users/user-role.enum';
import { UserStatus } from './../src/users/user-status.enum';
import { truncateAllTables } from './utils/database-cleaner';

interface ErrorBody {
  code: string;
}

interface TourListItemBody {
  id: number;
  title: string;
  categoryName: string | null;
  thumbnailUrl: string | null;
  priceFrom: number;
  nearestStartDate: string;
}

interface TourListBody {
  items: TourListItemBody[];
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
  images: { id: number; imageUrl: string; sortOrder: number }[];
  ratingAverage: number;
  ratingCount: number;
}

interface TourTimeListItemBody {
  id: number;
  startDate: string;
  endDate: string;
  price: number;
  maxCapacity: number;
  availableSlots: number;
}

interface TourTimeListBody {
  items: TourTimeListItemBody[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

describe('Tours (e2e)', () => {
  let app: NestExpressApplication<App>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication<App>>();
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

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
      status: TourStatus.PUBLISHED,
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
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      price: 3500000,
      maxCapacity: 20,
      status: TourTimeStatus.OPEN,
      ...overrides,
    });
    return tourTimesRepository.save(tourTime);
  }

  async function createTourImage(
    tourId: number,
    overrides: Partial<TourImage> = {},
  ): Promise<TourImage> {
    const tourImagesRepository = dataSource.getRepository(TourImage);
    const image = tourImagesRepository.create({
      tourId,
      imageUrl: '/uploads/tours/a.jpg',
      sortOrder: 0,
      ...overrides,
    });
    return tourImagesRepository.save(image);
  }

  describe('GET /api/v1/tours', () => {
    it('only lists published tours with a bookable tour time', async () => {
      const category = await createCategory();
      const published = await createTour({ categoryId: category.id });
      await createTourTime(published.id);
      await createTourImage(published.id, { sortOrder: 1, imageUrl: '/b.jpg' });
      await createTourImage(published.id, { sortOrder: 0, imageUrl: '/a.jpg' });

      const draft = await createTour({
        title: 'Draft tour',
        status: TourStatus.DRAFT,
      });
      await createTourTime(draft.id);

      await createTour({ title: 'No times tour' });

      const pastOnly = await createTour({ title: 'Past only tour' });
      await createTourTime(pastOnly.id, {
        startDate: '2020-01-01',
        endDate: '2020-01-03',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/tours')
        .expect(200);

      const body = res.body as TourListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        id: published.id,
        title: 'Đà Nẵng - Hội An',
        categoryName: 'Du lịch biển',
        thumbnailUrl: '/a.jpg',
        priceFrom: 3500000,
        nearestStartDate: '2026-11-01',
      });
    });

    it('filters by keyword, categoryId, and price range', async () => {
      const category = await createCategory();
      const match = await createTour({
        title: 'Đà Nẵng - Hội An',
        categoryId: category.id,
      });
      await createTourTime(match.id, { price: 3500000 });

      const other = await createTour({ title: 'Phú Quốc' });
      await createTourTime(other.id, { price: 5000000 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/tours')
        .query({
          keyword: 'Hội An',
          categoryId: category.id,
          maxPrice: 4000000,
        })
        .expect(200);

      const body = res.body as TourListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(match.id);
    });

    it('returns 400 INVALID_DATE_RANGE when startDate is not before endDate', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tours')
        .query({ startDate: '2026-11-05', endDate: '2026-11-01' })
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('GET /api/v1/tours/:tourId', () => {
    it('returns 404 for a non-existent tour', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tours/999999')
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_NOT_FOUND');
    });

    it('returns 404 for a draft tour', async () => {
      const draft = await createTour({ status: TourStatus.DRAFT });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tours/${draft.id}`)
        .expect(404);

      expect((res.body as ErrorBody).code).toBe('TOUR_NOT_FOUND');
    });

    it('returns the tour detail with images and no approved reviews', async () => {
      const category = await createCategory();
      const tour = await createTour({ categoryId: category.id });
      await createTourImage(tour.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tours/${tour.id}`)
        .expect(200);

      const body = res.body as TourDetailBody;
      expect(body).toMatchObject({
        id: tour.id,
        category: { id: category.id, name: 'Du lịch biển' },
        title: 'Đà Nẵng - Hội An',
        ratingAverage: 0,
        ratingCount: 0,
      });
      expect(body.images).toHaveLength(1);
    });

    it('computes ratingAverage/ratingCount from approved reviews only', async () => {
      const tour = await createTour();
      const tourTime = await createTourTime(tour.id);
      const usersRepository = dataSource.getRepository(User);
      const customer = await usersRepository.save(
        usersRepository.create({
          email: 'customer@example.com',
          password: 'hashed',
          fullName: 'Customer',
          phone: '0911111111',
          status: UserStatus.ACTIVE,
          role: UserRole.USER,
        }),
      );
      const bookingsRepository = dataSource.getRepository(Booking);
      const approvedBooking = await bookingsRepository.save(
        bookingsRepository.create({
          tourTimeId: tourTime.id,
          userId: customer.id,
          numberOfSlots: 1,
          totalPrice: 0,
          status: BookingStatus.COMPLETED,
        }),
      );
      const pendingBooking = await bookingsRepository.save(
        bookingsRepository.create({
          tourTimeId: tourTime.id,
          userId: customer.id,
          numberOfSlots: 1,
          totalPrice: 0,
          status: BookingStatus.COMPLETED,
        }),
      );
      const reviewsRepository = dataSource.getRepository(Review);
      await reviewsRepository.save(
        reviewsRepository.create({
          bookingId: approvedBooking.id,
          rating: 4,
          comment: 'Tốt',
          status: ReviewStatus.APPROVED,
        }),
      );
      await reviewsRepository.save(
        reviewsRepository.create({
          bookingId: pendingBooking.id,
          rating: 1,
          comment: 'Chưa duyệt, không nên tính',
          status: ReviewStatus.PENDING,
        }),
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tours/${tour.id}`)
        .expect(200);

      const body = res.body as TourDetailBody;
      expect(body.ratingAverage).toBe(4);
      expect(body.ratingCount).toBe(1);
    });
  });

  describe('GET /api/v1/tours/:tourId/times', () => {
    it('returns 404 for a draft tour', async () => {
      const draft = await createTour({ status: TourStatus.DRAFT });

      await request(app.getHttpServer())
        .get(`/api/v1/tours/${draft.id}/times`)
        .expect(404);
    });

    it('only lists open, upcoming tour times with availableSlots', async () => {
      const tour = await createTour();
      const open = await createTourTime(tour.id, { maxCapacity: 10 });
      await createTourTime(tour.id, { status: TourTimeStatus.CANCELLED });
      await createTourTime(tour.id, {
        startDate: '2020-01-01',
        endDate: '2020-01-03',
      });

      const customer = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: 'customer@example.com',
          password: 'hashed',
          fullName: 'Customer',
          phone: '0911111111',
          status: UserStatus.ACTIVE,
          role: UserRole.USER,
        }),
      );
      await dataSource.getRepository(Booking).save(
        dataSource.getRepository(Booking).create({
          tourTimeId: open.id,
          userId: customer.id,
          numberOfSlots: 3,
          totalPrice: 0,
          status: BookingStatus.CONFIRMED,
        }),
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tours/${tour.id}/times`)
        .expect(200);

      const body = res.body as TourTimeListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        id: open.id,
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        maxCapacity: 10,
        availableSlots: 7,
      });
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
