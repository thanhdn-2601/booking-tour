import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { MailService } from '../mail/mail.service';
import { TourTime } from '../tours/tour-time.entity';
import { ActorType } from './actor-type.enum';
import { BOOKING_MAIL_TEMPLATE_KEY } from './booking.constants';
import { BookingStatusHistory } from './booking-status-history.entity';
import { BookingStatus } from './booking-status.enum';
import { Booking } from './booking.entity';
import { AdminListBookingsQueryDto } from './dto/admin-list-bookings-query.dto';
import { AdminBookingDetailResponse } from './interfaces/admin-booking-detail-response.interface';
import { AdminBookingListItemResponse } from './interfaces/admin-booking-list-item-response.interface';
import { TransitionOutcome } from './interfaces/transition-outcome.interface';
import { UpdateBookingStatusResponse } from './interfaces/update-booking-status-response.interface';

@Injectable()
export class AdminBookingsService {
  private readonly logger = new Logger(AdminBookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(BookingStatusHistory)
    private readonly historiesRepository: Repository<BookingStatusHistory>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
    private readonly mailService: MailService,
  ) {}

  async findAllForAdmin(
    query: AdminListBookingsQueryDto,
  ): Promise<PaginatedResponse<AdminBookingListItemResponse>> {
    const { status, tourId, tourTimeId, userId, page, pageSize } = query;
    const applyFilters = (qb: SelectQueryBuilder<Booking>): void => {
      if (status) qb.andWhere('booking.status = :status', { status });
      if (tourTimeId) {
        qb.andWhere('booking.tourTimeId = :tourTimeId', { tourTimeId });
      }
      if (userId) qb.andWhere('booking.userId = :userId', { userId });
      if (tourId) qb.andWhere('tourTime.tourId = :tourId', { tourId });
    };

    const countQuery = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.tourTime', 'tourTime');
    applyFilters(countQuery);

    const listQuery = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.user', 'user')
      .leftJoin('booking.tourTime', 'tourTime')
      .leftJoin('tourTime.tour', 'tour')
      .select('booking.id', 'id')
      .addSelect('user.email', 'userEmail')
      .addSelect('tour.title', 'tourTitle')
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
        userEmail: string;
        tourTitle: string;
        status: BookingStatus;
        totalPrice: number;
      }>(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        userEmail: row.userEmail,
        tourTitle: row.tourTitle,
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

  async getById(bookingId: number): Promise<AdminBookingDetailResponse> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: { user: true, tourTime: true },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        user: { id: true, email: true },
        tourTime: { id: true, startDate: true },
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
      user: booking.user,
      tourTime: booking.tourTime,
      status: booking.status,
      totalPrice: booking.totalPrice,
      history,
    };
  }

  async approve(bookingId: number): Promise<UpdateBookingStatusResponse> {
    const outcome = await this.dataSource.transaction(
      async (manager): Promise<TransitionOutcome> => {
        const booking = await manager.findOne(Booking, {
          where: { id: bookingId },
          select: {
            id: true,
            status: true,
            tourTimeId: true,
            numberOfSlots: true,
          },
        });
        if (!booking) return { kind: 'not_found' };
        if (booking.status !== BookingStatus.PENDING) {
          return { kind: 'invalid_transition' };
        }

        const tourTime = await manager
          .createQueryBuilder(TourTime, 'tourTime')
          .setLock('pessimistic_write')
          .where('tourTime.id = :id', { id: booking.tourTimeId })
          .select(['tourTime.id', 'tourTime.maxCapacity'])
          .getOne();
        if (!tourTime) return { kind: 'not_found' };

        const { sum } = (await manager
          .createQueryBuilder(Booking, 'booking')
          .select('COALESCE(SUM(booking.numberOfSlots), 0)', 'sum')
          .where('booking.tourTimeId = :tourTimeId', {
            tourTimeId: booking.tourTimeId,
          })
          .andWhere('booking.status = :status', {
            status: BookingStatus.CONFIRMED,
          })
          .getRawOne()) as { sum: string };
        const confirmedSlots = Number(sum);
        if (confirmedSlots + booking.numberOfSlots > tourTime.maxCapacity) {
          return { kind: 'not_enough_slots' };
        }

        const updatedAt = new Date();
        const result = await manager.update(
          Booking,
          { id: bookingId, status: BookingStatus.PENDING },
          { status: BookingStatus.CONFIRMED, updatedAt },
        );
        if (!result.affected) return { kind: 'invalid_transition' };

        await manager.insert(BookingStatusHistory, {
          bookingId,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.CONFIRMED,
          reason: null,
          actorType: ActorType.ADMIN,
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
    if (outcome.kind === 'invalid_transition') {
      throw new ConflictException({
        code: 'INVALID_BOOKING_TRANSITION',
        message: this.i18n.t('bookings.invalid_booking_transition'),
      });
    }
    if (outcome.kind === 'not_enough_slots') {
      throw new ConflictException({
        code: 'NOT_ENOUGH_SLOTS',
        message: this.i18n.t('bookings.not_enough_slots'),
      });
    }
    await this.notifyBookingStatusChange(
      bookingId,
      BookingStatus.CONFIRMED,
      null,
    );
    return {
      id: bookingId,
      status: BookingStatus.CONFIRMED,
      updatedAt: outcome.updatedAt,
    };
  }

  async reject(
    bookingId: number,
    reason: string | undefined,
  ): Promise<UpdateBookingStatusResponse> {
    this.assertReasonProvided(reason);

    const outcome = await this.transitionFrom(
      bookingId,
      [BookingStatus.PENDING],
      BookingStatus.REJECTED,
      reason,
    );
    return this.toUpdateStatusResponseOrThrow(
      bookingId,
      BookingStatus.REJECTED,
      outcome,
      reason,
    );
  }

  async cancel(
    bookingId: number,
    reason: string | undefined,
  ): Promise<UpdateBookingStatusResponse> {
    this.assertReasonProvided(reason);

    const outcome = await this.transitionFrom(
      bookingId,
      [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      BookingStatus.CANCELLED_BY_ADMIN,
      reason,
    );
    return this.toUpdateStatusResponseOrThrow(
      bookingId,
      BookingStatus.CANCELLED_BY_ADMIN,
      outcome,
      reason,
    );
  }

  private assertReasonProvided(
    reason: string | undefined,
  ): asserts reason is string {
    if (!reason?.trim()) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: this.i18n.t('bookings.reason_required'),
      });
    }
  }

  private async transitionFrom(
    bookingId: number,
    fromStatuses: BookingStatus[],
    toStatus: BookingStatus,
    reason: string,
  ): Promise<TransitionOutcome> {
    return this.dataSource.transaction(
      async (manager): Promise<TransitionOutcome> => {
        const booking = await manager.findOne(Booking, {
          where: { id: bookingId },
          select: { id: true, status: true },
        });
        if (!booking) return { kind: 'not_found' };
        if (!fromStatuses.includes(booking.status)) {
          return { kind: 'invalid_transition' };
        }

        const updatedAt = new Date();
        const result = await manager.update(
          Booking,
          { id: bookingId, status: booking.status },
          { status: toStatus, updatedAt },
        );
        if (!result.affected) return { kind: 'invalid_transition' };

        await manager.insert(BookingStatusHistory, {
          bookingId,
          fromStatus: booking.status,
          toStatus,
          reason,
          actorType: ActorType.ADMIN,
        });
        return { kind: 'ok', updatedAt };
      },
    );
  }

  private async toUpdateStatusResponseOrThrow(
    bookingId: number,
    status: BookingStatus,
    outcome: TransitionOutcome,
    reason: string,
  ): Promise<UpdateBookingStatusResponse> {
    if (outcome.kind === 'not_found') {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: this.i18n.t('bookings.booking_not_found'),
      });
    }
    if (outcome.kind === 'invalid_transition') {
      throw new ConflictException({
        code: 'INVALID_BOOKING_TRANSITION',
        message: this.i18n.t('bookings.invalid_booking_transition'),
      });
    }
    if (outcome.kind === 'not_enough_slots') {
      // Unreachable for reject/cancel — kept for TransitionOutcome's shared type.
      throw new ConflictException({
        code: 'NOT_ENOUGH_SLOTS',
        message: this.i18n.t('bookings.not_enough_slots'),
      });
    }
    await this.notifyBookingStatusChange(bookingId, status, reason);
    return { id: bookingId, status, updatedAt: outcome.updatedAt };
  }

  private async notifyBookingStatusChange(
    bookingId: number,
    status: BookingStatus,
    reason: string | null,
  ): Promise<void> {
    const templateKey = BOOKING_MAIL_TEMPLATE_KEY[status];
    if (!templateKey) return;

    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: { user: true, tourTime: { tour: true } },
      select: {
        id: true,
        user: { id: true, email: true },
        tourTime: { id: true, tour: { id: true, title: true } },
      },
    });
    if (!booking) return;

    try {
      await this.mailService.send(
        booking.user.email,
        this.i18n.t(`mail.${templateKey}_subject`, { args: { id: bookingId } }),
        this.i18n.t(`mail.${templateKey}_body`, {
          args: {
            tourTitle: booking.tourTime.tour.title,
            reason: reason ?? '',
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to send booking status email for booking ${bookingId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
