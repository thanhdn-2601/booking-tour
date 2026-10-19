import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { AdminListReviewsQueryDto } from './dto/admin-list-reviews-query.dto';
import { AdminReviewListItemResponse } from './interfaces/admin-review-list-item-response.interface';
import { UpdateReviewStatusResponse } from './interfaces/update-review-status-response.interface';
import { Review } from './review.entity';
import { ReviewStatus } from './review-status.enum';

@Injectable()
export class AdminReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly i18n: I18nService,
  ) {}

  async findAllForAdmin(
    query: AdminListReviewsQueryDto,
  ): Promise<PaginatedResponse<AdminReviewListItemResponse>> {
    const { status, tourId, rating, page, pageSize } = query;

    const countQuery = this.reviewsRepository
      .createQueryBuilder('review')
      .leftJoin('review.booking', 'booking')
      .leftJoin('booking.tourTime', 'tourTime');
    const listQuery = this.reviewsRepository
      .createQueryBuilder('review')
      .leftJoin('review.booking', 'booking')
      .leftJoin('booking.user', 'user')
      .leftJoin('booking.tourTime', 'tourTime')
      .select('review.id', 'id')
      .addSelect('tourTime.tourId', 'tourId')
      .addSelect('user.email', 'userEmail')
      .addSelect('review.rating', 'rating')
      .addSelect('review.status', 'status')
      .orderBy('review.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (status) {
      countQuery.andWhere('review.status = :status', { status });
      listQuery.andWhere('review.status = :status', { status });
    }
    if (tourId) {
      countQuery.andWhere('tourTime.tourId = :tourId', { tourId });
      listQuery.andWhere('tourTime.tourId = :tourId', { tourId });
    }
    if (rating) {
      countQuery.andWhere('review.rating = :rating', { rating });
      listQuery.andWhere('review.rating = :rating', { rating });
    }

    const [total, rows] = await Promise.all([
      countQuery.getCount(),
      listQuery.getRawMany<{
        id: number;
        tourId: number;
        userEmail: string;
        rating: number;
        status: ReviewStatus;
      }>(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        tourId: row.tourId,
        userEmail: row.userEmail,
        rating: row.rating,
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

  approve(reviewId: number): Promise<UpdateReviewStatusResponse> {
    return this.transition(reviewId, ReviewStatus.APPROVED, null);
  }

  reject(
    reviewId: number,
    reason: string,
  ): Promise<UpdateReviewStatusResponse> {
    return this.transition(reviewId, ReviewStatus.REJECTED, reason);
  }

  private async transition(
    reviewId: number,
    toStatus: ReviewStatus,
    reason: string | null,
  ): Promise<UpdateReviewStatusResponse> {
    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId },
      select: { id: true, status: true },
    });
    if (!review) {
      throw new NotFoundException({
        code: 'REVIEW_NOT_FOUND',
        message: this.i18n.t('reviews.review_not_found'),
      });
    }
    if (review.status !== ReviewStatus.PENDING) {
      throw new ConflictException({
        code: 'INVALID_REVIEW_TRANSITION',
        message: this.i18n.t('reviews.invalid_review_transition'),
      });
    }

    const updatedAt = new Date();
    const result = await this.reviewsRepository.update(
      { id: reviewId, status: ReviewStatus.PENDING },
      { status: toStatus, reason, updatedAt },
    );
    if (!result.affected) {
      throw new ConflictException({
        code: 'INVALID_REVIEW_TRANSITION',
        message: this.i18n.t('reviews.invalid_review_transition'),
      });
    }
    return { id: reviewId, status: toStatus, updatedAt };
  }
}
