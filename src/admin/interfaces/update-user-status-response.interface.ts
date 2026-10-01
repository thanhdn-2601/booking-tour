import { UserStatus } from '../../users/user-status.enum';

export interface UpdateUserStatusResponse {
  id: number;
  status: UserStatus;
  updatedAt: Date;
}
