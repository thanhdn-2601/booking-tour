export type TransitionOutcome =
  | { kind: 'not_found' }
  | { kind: 'invalid_transition' }
  | { kind: 'not_enough_slots' }
  | { kind: 'ok'; updatedAt: Date };
