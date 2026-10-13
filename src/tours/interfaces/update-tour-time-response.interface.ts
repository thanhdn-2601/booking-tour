import { TourTimeStatus } from '../tour-time-status.enum';

export interface UpdateTourTimeResponse {
  id: number;
  price: number;
  maxCapacity: number;
  status: TourTimeStatus;
}
