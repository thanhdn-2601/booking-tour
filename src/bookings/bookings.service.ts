import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { TourTimeStatus } from '../tours/tour-time-status.enum';
import { TourTime } from '../tours/tour-time.entity';
import { ActorType } from './actor-type.enum';
import { BookingStatusHistory } from './booking-status-history.entity';
import { BookingStatus } from './booking-status.enum';
import { Booking } from './booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UserListBookingsQueryDto } from './dto/user-list-bookings-query.dto';
import { getBookedSlots } from './get-booked-slots.util';
import { CancelBookingOutcome } from './interfaces/cancel-booking-outcome.interface';
import { CreateBookingOutcome } from './interfaces/create-booking-outcome.interface';
import { CreateBookingResponse } from './interfaces/create-booking-response.interface';
import { UpdateBookingStatusResponse } from './interfaces/update-booking-status-response.interface';
import { UserBookingDetailResponse } from './interfaces/user-booking-detail-response.interface';
import { UserBookingListItemResponse } from './interfaces/user-booking-list-item-response.interface';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(BookingStatusHistory)
    private readonly historiesRepository: Repository<BookingStatusHistory>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async createBooking(
    userId: number,
    dto: CreateBookingDto,
  ): Promise<CreateBookingResponse> {
    const outcome = await this.dataSource.transaction(
      async (manager): Promise<CreateBookingOutcome> => {
        const tourTime = await manager
          .createQueryBuilder(TourTime, 'tourTime')
          .setLock('pessimistic_write')
          .where('tourTime.id = :id', { id: dto.tourTimeId })
          .select([
            'tourTime.id',
            'tourTime.price',
            'tourTime.maxCapacity',
            'tourTime.status',
          ])
          .getOne();
        if (!tourTime) return { kind: 'tour_time_not_found' };
        if (tourTime.status !== TourTimeStatus.OPEN) {
          return { kind: 'tour_time_not_open' };
        }

        const bookedSlots = await getBookedSlots(manager, dto.tourTimeId);
        if (bookedSlots + dto.numberOfSlots > tourTime.maxCapacity) {
          return { kind: 'not_enough_slots' };
        }

        const booking = await manager.save(
          Booking,
          manager.create(Booking, {
            userId,
            tourTimeId: dto.tourTimeId,
            numberOfSlots: dto.numberOfSlots,
            totalPrice: tourTime.price * dto.numberOfSlots,
            status: BookingStatus.PENDING,
          }),
        );
        await manager.insert(BookingStatusHistory, {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: BookingStatus.PENDING,
          reason: null,
          actorType: ActorType.USER,
        });
        return { kind: 'ok', booking };
      },
    );

    if (outcome.kind === 'tour_time_not_found') {
      throw new NotFoundException({
        code: 'TOUR_TIME_NOT_FOUND',
        message: this.i18n.t('tours.tour_time_not_found'),
      });
    }
    if (outcome.kind === 'tour_time_not_open') {
      throw new ConflictException({
        code: 'TOUR_TIME_NOT_OPEN',
        message: this.i18n.t('bookings.tour_time_not_open'),
      });
    }
    if (outcome.kind === 'not_enough_slots') {
      throw new ConflictException({
        code: 'NOT_ENOUGH_SLOTS',
        message: this.i18n.t('bookings.not_enough_slots'),
      });
    }
    const { booking } = outcome;
    return {
      id: booking.id,
      tourTimeId: booking.tourTimeId,
      numberOfSlots: booking.numberOfSlots,
      status: booking.status,
      totalPrice: booking.totalPrice,
      createdAt: booking.createdAt,
    };
  }

  async findAllForUser(
    userId: number,
    query: UserListBookingsQueryDto,
  ): Promise<PaginatedResponse<UserBookingListItemResponse>> {
    const { status, page, pageSize } = query;
    const applyFilters = (qb: SelectQueryBuilder<Booking>): void => {
      qb.andWhere('booking.userId = :userId', { userId });
      if (status) qb.andWhere('booking.status = :status', { status });
    };

    const countQuery = this.bookingsRepository.createQueryBuilder('booking');
    applyFilters(countQuery);

    const listQuery = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.tourTime', 'tourTime')
      .leftJoin('tourTime.tour', 'tour')
      .select('booking.id', 'id')
      .addSelect('tour.title', 'tourTitle')
      .addSelect("to_char(tourTime.startDate, 'YYYY-MM-DD')", 'startDate')
      .addSelect('booking.status', 'status')
      .addSelect('booking.totalPrice', 'totalPrice')
      .orderBy('booking.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    applyFilters(listQuery);

    const [total, rows] = await Promise.all([
      countQuery.getCount(),
      listQuery.getRawMany<{
        id: number;
        tourTitle: string;
        startDate: string;
        status: BookingStatus;
        totalPrice: number;
      }>(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        tourTitle: row.tourTitle,
        startDate: row.startDate,
        status: row.status,
        totalPrice: row.totalPrice,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getByIdForUser(
    userId: number,
    bookingId: number,
  ): Promise<UserBookingDetailResponse> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId, userId },
      relations: { tourTime: true },
      select: {
        id: true,
        numberOfSlots: true,
        status: true,
        totalPrice: true,
        tourTime: { id: true, startDate: true, endDate: true },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: this.i18n.t('bookings.booking_not_found'),
      });
    }

    const history = await this.historiesRepository.find({
      where: { bookingId },
      select: {
        fromStatus: true,
        toStatus: true,
        reason: true,
        actorType: true,
        createdAt: true,
      },
      order: { createdAt: 'ASC' },
    });

    return {
      id: booking.id,
      tourTime: booking.tourTime,
      numberOfSlots: booking.numberOfSlots,
      status: booking.status,
      totalPrice: booking.totalPrice,
      history,
    };
  }

  async cancelForUser(
    userId: number,
    bookingId: number,
  ): Promise<UpdateBookingStatusResponse> {
    const outcome = await this.dataSource.transaction(
      async (manager): Promise<CancelBookingOutcome> => {
        const booking = await manager.findOne(Booking, {
          where: { id: bookingId, userId },
          select: { id: true, status: true },
        });
        if (!booking) return { kind: 'not_found' };
        if (booking.status !== BookingStatus.PENDING) {
          return { kind: 'cannot_be_cancelled' };
        }

        const updatedAt = new Date();
        const result = await manager.update(
          Booking,
          { id: bookingId, userId, status: BookingStatus.PENDING },
          { status: BookingStatus.CANCELLED_BY_USER, updatedAt },
        );
        if (!result.affected) return { kind: 'cannot_be_cancelled' };

        await manager.insert(BookingStatusHistory, {
          bookingId,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.CANCELLED_BY_USER,
          reason: null,
          actorType: ActorType.USER,
        });
        return { kind: 'ok', updatedAt };
      },
    );

    if (outcome.kind === 'not_found') {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: this.i18n.t('bookings.booking_not_found'),
      });
    }
    if (outcome.kind === 'cannot_be_cancelled') {
      throw new ConflictException({
        code: 'BOOKING_CANNOT_BE_CANCELLED',
        message: this.i18n.t('bookings.booking_cannot_be_cancelled'),
      });
    }
    return {
      id: bookingId,
      status: BookingStatus.CANCELLED_BY_USER,
      updatedAt: outcome.updatedAt,
    };
  }
}
