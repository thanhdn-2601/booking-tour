import { Booking } from '../booking.entity';

export type CreateBookingOutcome =
  | { kind: 'tour_time_not_found' }
  | { kind: 'tour_time_not_open' }
  | { kind: 'not_enough_slots' }
  | { kind: 'ok'; booking: Booking };
