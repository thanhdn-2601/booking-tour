import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminBookingsService } from './admin-bookings.service';
import { BookingStatusHistory } from './booking-status-history.entity';
import { Booking } from './booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingStatusHistory])],
  controllers: [BookingsController],
  providers: [AdminBookingsService, BookingsService],
  exports: [AdminBookingsService, BookingsService],
})
export class BookingsModule {}
