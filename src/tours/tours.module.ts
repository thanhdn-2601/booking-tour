import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from '../bookings/booking.entity';
import { CategoriesModule } from '../categories/categories.module';
import { Review } from '../reviews/review.entity';
import { TourImagesService } from './tour-images.service';
import { TourImage } from './tour-image.entity';
import { TourTimesService } from './tour-times.service';
import { TourTime } from './tour-time.entity';
import { Tour } from './tour.entity';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tour, TourTime, TourImage, Booking, Review]),
    CategoriesModule,
  ],
  controllers: [ToursController],
  providers: [ToursService, TourImagesService, TourTimesService],
  exports: [ToursService, TourImagesService, TourTimesService],
})
export class ToursModule {}
