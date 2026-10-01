import { UserRole } from '../../users/user-role.enum';
import { UserStatus } from '../../users/user-status.enum';

export interface AdminUserListItemResponse {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}
