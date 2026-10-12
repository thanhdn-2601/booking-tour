import { TourStatus } from '../tour-status.enum';

export interface AdminTourDetailResponse {
  id: number;
  category: { id: number; name: string } | null;
  title: string;
  description: string;
  status: TourStatus;
  // Always empty until the tour-images feature exists.
  images: unknown[];
}
