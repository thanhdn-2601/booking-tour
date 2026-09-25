import { UserRole } from '../../users/user-role.enum';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
}
