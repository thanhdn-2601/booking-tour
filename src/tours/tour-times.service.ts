import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DeleteResult, Repository, SelectQueryBuilder } from 'typeorm';

import { BOOKED_BOOKING_STATUSES } from '../bookings/booking.constants';
import { Booking } from '../bookings/booking.entity';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { isForeignKeyViolation } from '../common/postgres-errors';
import { AdminListTourTimesQueryDto } from './dto/admin-list-tour-times-query.dto';
import { CreateTourTimeDto } from './dto/create-tour-time.dto';
import { UpdateTourTimeDto } from './dto/update-tour-time.dto';
import { AdminTourTimeListItemResponse } from './interfaces/admin-tour-time-list-item-response.interface';
import { CreateTourTimeResponse } from './interfaces/create-tour-time-response.interface';
import { UpdateTourTimeResponse } from './interfaces/update-tour-time-response.interface';
import { TourTimeStatus } from './tour-time-status.enum';
import { TourTime } from './tour-time.entity';
import { ToursService } from './tours.service';

@Injectable()
export class TourTimesService {
  constructor(
    @InjectRepository(TourTime)
    private readonly tourTimesRepository: Repository<TourTime>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly toursService: ToursService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    tourId: number,
    dto: CreateTourTimeDto,
  ): Promise<CreateTourTimeResponse> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: this.i18n.t('tours.invalid_date_range'),
      });
    }

    const tourExists = await this.toursService.exists(tourId);
    if (!tourExists) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: this.i18n.t('tours.tour_not_found'),
      });
    }

    const tourTime = this.tourTimesRepository.create({
      tourId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      price: dto.price,
      maxCapacity: dto.maxCapacity,
      status: TourTimeStatus.OPEN,
    });
    let saved: TourTime;
    try {
      saved = await this.tourTimesRepository.save(tourTime);
    } catch (error) {
      // Closes the gap between the exists() check above and this write — the
      // tour could have been deleted in between.
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException({
          code: 'TOUR_NOT_FOUND',
          message: this.i18n.t('tours.tour_not_found'),
        });
      }
      throw error;
    }
    return {
      id: saved.id,
      startDate: saved.startDate,
      endDate: saved.endDate,
      price: saved.price,
      maxCapacity: saved.maxCapacity,
      status: saved.status,
    };
  }

  async findAllForTour(
    tourId: number,
    query: AdminListTourTimesQueryDto,
  ): Promise<PaginatedResponse<AdminTourTimeListItemResponse>> {
    const tourExists = await this.toursService.exists(tourId);
    if (!tourExists) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: this.i18n.t('tours.tour_not_found'),
      });
    }

    const { status, startDate, endDate, page, pageSize } = query;
    const applyFilters = (qb: SelectQueryBuilder<TourTime>): void => {
      qb.andWhere('tourTime.tourId = :tourId', { tourId });
      if (status) qb.andWhere('tourTime.status = :status', { status });
      if (startDate) {
        qb.andWhere('tourTime.startDate >= :startDate', { startDate });
      }
      if (endDate) {
        qb.andWhere('tourTime.endDate <= :endDate', { endDate });
      }
    };

    const countQuery = this.tourTimesRepository.createQueryBuilder('tourTime');
    applyFilters(countQuery);

    const listQuery = this.tourTimesRepository
      .createQueryBuilder('tourTime')
      .leftJoin(
        'tourTime.bookings',
        'booking',
        'booking.status IN (:...bookedStatuses)',
        { bookedStatuses: BOOKED_BOOKING_STATUSES },
      )
      .select('tourTime.id', 'id')
      // Cast to text — the pg driver otherwise returns a JS Date for a
      // `date` column from a raw query, and serializing that back to JSON
      // can shift it by a day depending on the server's local timezone.
      .addSelect("to_char(tourTime.startDate, 'YYYY-MM-DD')", 'startDate')
      .addSelect('tourTime.price', 'price')
      .addSelect('tourTime.maxCapacity', 'maxCapacity')
      .addSelect('tourTime.status', 'status')
      .addSelect('COALESCE(SUM(booking.numberOfSlots), 0)', 'bookedSlots')
      .groupBy('tourTime.id')
      .orderBy('tourTime.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    applyFilters(listQuery);

    const [total, rows] = await Promise.all([
      countQuery.getCount(),
      listQuery.getRawMany<{
        id: number;
        startDate: string;
        price: number;
        maxCapacity: number;
        status: TourTimeStatus;
        bookedSlots: string;
      }>(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        startDate: row.startDate,
        price: row.price,
        maxCapacity: row.maxCapacity,
        bookedSlots: Number(row.bookedSlots),
        status: row.status,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async update(
    tourId: number,
    timeId: number,
    dto: UpdateTourTimeDto,
  ): Promise<UpdateTourTimeResponse> {
    const exists = await this.tourTimesRepository.exists({
      where: { id: timeId, tourId },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'TOUR_TIME_NOT_FOUND',
        message: this.i18n.t('tours.tour_time_not_found'),
      });
    }

    // No booking-creation endpoint exists yet, so bookedSlots can't change
    // between this check and the update below — revisit once one does.
    const bookedSlots = await this.getBookedSlots(timeId);
    if (dto.maxCapacity < bookedSlots) {
      throw new ConflictException({
        code: 'CAPACITY_BELOW_BOOKED',
        message: this.i18n.t('tours.capacity_below_booked'),
      });
    }

    await this.tourTimesRepository.update(
      { id: timeId, tourId },
      { price: dto.price, maxCapacity: dto.maxCapacity, status: dto.status },
    );
    return {
      id: timeId,
      price: dto.price,
      maxCapacity: dto.maxCapacity,
      status: dto.status,
    };
  }

  async remove(tourId: number, timeId: number): Promise<void> {
    let result: DeleteResult;
    try {
      result = await this.tourTimesRepository.delete({ id: timeId, tourId });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException({
          code: 'TOUR_TIME_HAS_BOOKING',
          message: this.i18n.t('tours.tour_time_has_booking'),
        });
      }
      throw error;
    }
    if (!result.affected) {
      throw new NotFoundException({
        code: 'TOUR_TIME_NOT_FOUND',
        message: this.i18n.t('tours.tour_time_not_found'),
      });
    }
  }

  private async getBookedSlots(timeId: number): Promise<number> {
    const { sum } = (await this.bookingsRepository
      .createQueryBuilder('booking')
      .select('COALESCE(SUM(booking.numberOfSlots), 0)', 'sum')
      .where('booking.tourTimeId = :timeId', { timeId })
      .andWhere('booking.status IN (:...bookedStatuses)', {
        bookedStatuses: BOOKED_BOOKING_STATUSES,
      })
      .getRawOne()) as { sum: string };
    return Number(sum);
  }
}
