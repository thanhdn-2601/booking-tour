import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { BookingCompletionTask } from './../src/bookings/booking-completion.task';
import { BookingStatusHistory } from './../src/bookings/booking-status-history.entity';
import { BookingStatus } from './../src/bookings/booking-status.enum';
import { Booking } from './../src/bookings/booking.entity';
import { TourTimeStatus } from './../src/tours/tour-time-status.enum';
import { TourTime } from './../src/tours/tour-time.entity';
import { Tour } from './../src/tours/tour.entity';
import { User } from './../src/users/user.entity';
import { UserRole } from './../src/users/user-role.enum';
import { UserStatus } from './../src/users/user-status.enum';
import { truncateAllTables } from './utils/database-cleaner';

describe('BookingCompletionTask (e2e)', () => {
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let task: BookingCompletionTask;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());
    task = moduleFixture.get(BookingCompletionTask);
  });

  async function createCustomer(): Promise<User> {
    const usersRepository = dataSource.getRepository(User);
    return usersRepository.save(
      usersRepository.create({
        email: 'customer@example.com',
        password: 'hashed',
        fullName: 'Customer',
        phone: '0911111111',
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      }),
    );
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

  async function createTourTime(
    tourId: number,
    overrides: Partial<TourTime> = {},
  ): Promise<TourTime> {
    const tourTimesRepository = dataSource.getRepository(TourTime);
    return tourTimesRepository.save(
      tourTimesRepository.create({
        tourId,
        startDate: '2020-01-01',
        endDate: '2020-01-03',
        price: 100,
        maxCapacity: 10,
        status: TourTimeStatus.OPEN,
        ...overrides,
      }),
    );
  }

  async function createBooking(
    tourTimeId: number,
    userId: number,
    status: BookingStatus,
  ): Promise<Booking> {
    const bookingsRepository = dataSource.getRepository(Booking);
    return bookingsRepository.save(
      bookingsRepository.create({
        tourTimeId,
        userId,
        numberOfSlots: 1,
        totalPrice: 100,
        status,
      }),
    );
  }

  it('completes confirmed bookings whose tour time has ended', async () => {
    const customer = await createCustomer();
    const tour = await createTour();
    const pastTourTime = await createTourTime(tour.id, {
      startDate: '2020-01-01',
      endDate: '2020-01-03',
    });
    const futureTourTime = await createTourTime(tour.id, {
      startDate: '2099-01-01',
      endDate: '2099-01-03',
    });

    const dueBooking = await createBooking(
      pastTourTime.id,
      customer.id,
      BookingStatus.CONFIRMED,
    );
    const notYetDueBooking = await createBooking(
      futureTourTime.id,
      customer.id,
      BookingStatus.CONFIRMED,
    );
    const wrongStatusBooking = await createBooking(
      pastTourTime.id,
      customer.id,
      BookingStatus.PENDING,
    );
    const alreadyCompletedBooking = await createBooking(
      pastTourTime.id,
      customer.id,
      BookingStatus.COMPLETED,
    );

    const affected = await task.completeFinishedBookings();
    expect(affected).toBe(1);

    const bookingsRepository = dataSource.getRepository(Booking);
    await expect(
      bookingsRepository.findOneByOrFail({ id: dueBooking.id }),
    ).resolves.toMatchObject({ status: BookingStatus.COMPLETED });
    await expect(
      bookingsRepository.findOneByOrFail({ id: notYetDueBooking.id }),
    ).resolves.toMatchObject({ status: BookingStatus.CONFIRMED });
    await expect(
      bookingsRepository.findOneByOrFail({ id: wrongStatusBooking.id }),
    ).resolves.toMatchObject({ status: BookingStatus.PENDING });
    await expect(
      bookingsRepository.findOneByOrFail({ id: alreadyCompletedBooking.id }),
    ).resolves.toMatchObject({ status: BookingStatus.COMPLETED });

    const history = await dataSource.getRepository(BookingStatusHistory).find({
      where: { bookingId: dueBooking.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: 'confirmed',
      toStatus: 'completed',
      actorType: 'system',
    });
  });

  it('is a no-op when nothing is due', async () => {
    const affected = await task.completeFinishedBookings();
    expect(affected).toBe(0);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await moduleFixture.close();
  });
});
