import { TourStatus } from '../tour-status.enum';

export interface AdminTourListItemResponse {
  id: number;
  title: string;
  categoryName: string | null;
  status: TourStatus;
  timesCount: number;
}
