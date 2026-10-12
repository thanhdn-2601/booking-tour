import { TourStatus } from '../tour-status.enum';

export interface UpdateTourStatusResponse {
  id: number;
  status: TourStatus;
  updatedAt: Date;
}
