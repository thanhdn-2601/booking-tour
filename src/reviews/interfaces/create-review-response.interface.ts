import { ReviewStatus } from '../review-status.enum';

export interface CreateReviewResponse {
  id: number;
  bookingId: number;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: Date;
}
