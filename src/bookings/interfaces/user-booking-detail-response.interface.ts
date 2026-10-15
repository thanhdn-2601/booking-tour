import { BookingStatus } from '../booking-status.enum';
import { BookingStatusHistoryItem } from './booking-status-history-item.interface';

export interface UserBookingDetailResponse {
  id: number;
  tourTime: { id: number; startDate: string; endDate: string };
  numberOfSlots: number;
  status: BookingStatus;
  totalPrice: number;
  history: BookingStatusHistoryItem[];
}
