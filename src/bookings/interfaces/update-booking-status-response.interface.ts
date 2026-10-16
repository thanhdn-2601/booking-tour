import { BookingStatus } from '../booking-status.enum';

export interface UpdateBookingStatusResponse {
  id: number;
  status: BookingStatus;
  updatedAt: Date;
}
