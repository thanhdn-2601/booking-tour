import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { BookingStatus } from '../bookings/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
import { isUniqueViolation } from '../common/postgres-errors';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewResponse } from './interfaces/create-review-response.interface';
import { Review } from './review.entity';
import { ReviewStatus } from './review-status.enum';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    bookingId: number,
    dto: CreateReviewDto,
  ): Promise<CreateReviewResponse> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId, userId },
      select: { id: true, status: true },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: this.i18n.t('bookings.booking_not_found'),
      });
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException({
        code: 'BOOKING_NOT_COMPLETED',
        message: this.i18n.t('reviews.booking_not_completed'),
      });
    }

    const review = this.reviewsRepository.create({
      bookingId,
      rating: dto.rating,
      comment: dto.comment,
      status: ReviewStatus.PENDING,
    });
    let saved: Review;
    try {
      saved = await this.reviewsRepository.save(review);
    } catch (error) {
      // The booking_id UNIQUE constraint is the single source of truth for
      // "one review per booking" — it also catches a race between two
      // concurrent submissions for the same booking.
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'REVIEW_ALREADY_EXISTS',
          message: this.i18n.t('reviews.review_already_exists'),
        });
      }
      throw error;
    }
    return {
      id: saved.id,
      bookingId: saved.bookingId,
      rating: saved.rating,
      comment: saved.comment,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }
}
