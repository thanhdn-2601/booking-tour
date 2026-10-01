import { UserRole } from '../../users/user-role.enum';

export interface UpdateUserRoleResponse {
  id: number;
  role: UserRole;
  updatedAt: Date;
}
