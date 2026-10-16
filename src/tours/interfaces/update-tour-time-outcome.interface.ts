export type UpdateTourTimeOutcome =
  { kind: 'not_found' } | { kind: 'capacity_below_booked' } | { kind: 'ok' };
