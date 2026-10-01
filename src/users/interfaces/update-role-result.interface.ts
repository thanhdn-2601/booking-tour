import { UserRole } from '../user-role.enum';

export interface UpdateRoleResult {
  id: number;
  role: UserRole;
  updatedAt: Date;
}
