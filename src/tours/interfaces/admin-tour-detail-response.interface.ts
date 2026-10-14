import { TourStatus } from '../tour-status.enum';
import { TourImageResponse } from './tour-image-response.interface';

export interface AdminTourDetailResponse {
  id: number;
  category: { id: number; name: string } | null;
  title: string;
  description: string;
  status: TourStatus;
  images: TourImageResponse[];
}
