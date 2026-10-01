import { UserRole } from '../../users/user-role.enum';
import { UserStatus } from '../../users/user-status.enum';

export interface AdminUserDetailResponse {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
}
