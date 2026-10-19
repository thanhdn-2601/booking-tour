import { ReviewStatus } from '../review-status.enum';

export interface AdminReviewListItemResponse {
  id: number;
  tourId: number;
  userEmail: string;
  rating: number;
  status: ReviewStatus;
}
