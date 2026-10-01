import { User } from '../user.entity';

export interface AdminUsersQueryResult {
  items: Pick<User, 'id' | 'email' | 'fullName' | 'role' | 'status'>[];
  total: number;
}
