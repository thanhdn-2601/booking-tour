import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from '../bookings/booking.entity';
import { AdminReviewsService } from './admin-reviews.service';
import { Review } from './review.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Booking])],
  controllers: [ReviewsController],
  providers: [ReviewsService, AdminReviewsService],
  exports: [AdminReviewsService],
})
export class ReviewsModule {}
