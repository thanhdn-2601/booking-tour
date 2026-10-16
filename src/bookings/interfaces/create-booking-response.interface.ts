import { BookingStatus } from '../booking-status.enum';

export interface CreateBookingResponse {
  id: number;
  tourTimeId: number;
  numberOfSlots: number;
  status: BookingStatus;
  totalPrice: number;
  createdAt: Date;
}
