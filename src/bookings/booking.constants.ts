import { BookingStatus } from './booking-status.enum';

export const BOOKED_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

export const BOOKING_MAIL_TEMPLATE_KEY: Partial<Record<BookingStatus, string>> =
  {
    [BookingStatus.CONFIRMED]: 'booking_confirmed',
    [BookingStatus.REJECTED]: 'booking_rejected',
    [BookingStatus.CANCELLED_BY_ADMIN]: 'booking_cancelled',
  };
