import { BookingStatus } from '../booking-status.enum';

export interface AdminBookingListItemResponse {
  id: number;
  userEmail: string;
  tourTitle: string;
  status: BookingStatus;
  totalPrice: number;
}
