import { ReviewStatus } from '../review-status.enum';

export interface UpdateReviewStatusResponse {
  id: number;
  status: ReviewStatus;
  updatedAt: Date;
}
