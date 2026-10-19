import { BookingStatus } from '../booking-status.enum';
import { BookingStatusHistoryItem } from './booking-status-history-item.interface';

export interface AdminBookingDetailResponse {
  id: number;
  user: { id: number; email: string };
  tourTime: { id: number; startDate: string };
  status: BookingStatus;
  totalPrice: number;
  history: BookingStatusHistoryItem[];
}
