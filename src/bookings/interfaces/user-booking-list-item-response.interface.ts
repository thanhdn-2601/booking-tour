import { BookingStatus } from '../booking-status.enum';

export interface UserBookingListItemResponse {
  id: number;
  tourTitle: string;
  startDate: string;
  status: BookingStatus;
  totalPrice: number;
}
