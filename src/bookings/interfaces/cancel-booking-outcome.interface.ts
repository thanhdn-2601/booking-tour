export type CancelBookingOutcome =
  | { kind: 'not_found' }
  | { kind: 'cannot_be_cancelled' }
  | { kind: 'ok'; updatedAt: Date };
