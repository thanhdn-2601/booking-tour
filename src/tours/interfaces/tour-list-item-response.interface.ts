export interface TourListItemResponse {
  id: number;
  title: string;
  categoryName: string | null;
  thumbnailUrl: string | null;
  priceFrom: number;
  nearestStartDate: string;
}
