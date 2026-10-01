import { UserStatus } from '../user-status.enum';

export type UpdateStatusOutcome =
  | { kind: 'not_found' }
  | { kind: 'unchanged' }
  | { kind: 'ok'; id: number; status: UserStatus; updatedAt: Date };
