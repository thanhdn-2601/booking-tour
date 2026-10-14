import { TourTimeStatus } from '../tour-time-status.enum';

export interface CreateTourTimeResponse {
  id: number;
  startDate: string;
  endDate: string;
  price: number;
  maxCapacity: number;
  status: TourTimeStatus;
}
