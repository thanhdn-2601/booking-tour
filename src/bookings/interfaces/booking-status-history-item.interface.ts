import { ActorType } from '../actor-type.enum';
import { BookingStatus } from '../booking-status.enum';

export interface BookingStatusHistoryItem {
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  reason: string | null;
  actorType: ActorType;
  createdAt: Date;
}
