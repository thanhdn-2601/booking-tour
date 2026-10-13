import { TourTimeStatus } from '../tour-time-status.enum';

export interface AdminTourTimeListItemResponse {
  id: number;
  startDate: string;
  price: number;
  maxCapacity: number;
  bookedSlots: number;
  status: TourTimeStatus;
}
