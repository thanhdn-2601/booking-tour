import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ActorType } from './actor-type.enum';
import { BookingStatus } from './booking-status.enum';

@Injectable()
export class BookingCompletionTask {
  private readonly logger = new Logger(BookingCompletionTask.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async completeFinishedBookings(): Promise<number> {
    const affected = (
      await this.dataSource.query<{ booking_id: number }[]>(
        `WITH completed AS (
         UPDATE bookings AS booking
         SET status = $1, updated_at = now()
         FROM tour_times AS tour_time
         WHERE tour_time.id = booking.tour_time_id
           AND booking.status = $2
           AND tour_time.end_date < CURRENT_DATE
         RETURNING booking.id
       )
       INSERT INTO booking_status_histories
         (booking_id, from_status, to_status, reason, actor_type)
       SELECT id, $2, $1, NULL, $3 FROM completed
       RETURNING booking_id`,
        [BookingStatus.COMPLETED, BookingStatus.CONFIRMED, ActorType.SYSTEM],
      )
    ).length;
    this.logger.log(`Marked ${affected} booking(s) as completed`);
    return affected;
  }
}
