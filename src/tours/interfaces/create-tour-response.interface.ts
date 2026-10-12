import { TourStatus } from '../tour-status.enum';

export interface CreateTourResponse {
  id: number;
  categoryId: number | null;
  title: string;
  status: TourStatus;
}
