import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesModule } from '../categories/categories.module';
import { ToursService } from './tours.service';
import { TourTime } from './tour-time.entity';
import { Tour } from './tour.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tour, TourTime]), CategoriesModule],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
