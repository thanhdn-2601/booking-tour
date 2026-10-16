import { EntityManager } from 'typeorm';

import { BOOKED_BOOKING_STATUSES } from './booking.constants';
import { Booking } from './booking.entity';

export async function getBookedSlots(
  manager: EntityManager,
  tourTimeId: number,
): Promise<number> {
  const { sum } = (await manager
    .createQueryBuilder(Booking, 'booking')
    .select('COALESCE(SUM(booking.numberOfSlots), 0)', 'sum')
    .where('booking.tourTimeId = :tourTimeId', { tourTimeId })
    .andWhere('booking.status IN (:...bookedStatuses)', {
      bookedStatuses: BOOKED_BOOKING_STATUSES,
    })
    .getRawOne()) as { sum: string };
  return Number(sum);
}
