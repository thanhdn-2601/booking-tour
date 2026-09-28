import { UserRole } from '../user-role.enum';
import { UserStatus } from '../user-status.enum';

export interface UserProfileResponse {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
}
