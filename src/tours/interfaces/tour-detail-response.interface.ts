import { TourImageResponse } from './tour-image-response.interface';

export interface TourDetailResponse {
  id: number;
  category: { id: number; name: string } | null;
  title: string;
  description: string;
  images: TourImageResponse[];
  ratingAverage: number;
  ratingCount: number;
}
