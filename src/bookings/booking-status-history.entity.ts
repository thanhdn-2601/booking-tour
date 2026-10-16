import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ActorType } from './actor-type.enum';
import { BookingStatus } from './booking-status.enum';
import { Booking } from './booking.entity';

// Append-only — rows are never updated or deleted once inserted.
@Entity('booking_status_histories')
export class BookingStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'booking_id' })
  bookingId: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'from_status', type: 'varchar', nullable: true })
  fromStatus: BookingStatus | null;

  @Column({ name: 'to_status', type: 'varchar' })
  toStatus: BookingStatus;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ name: 'actor_type', type: 'varchar' })
  actorType: ActorType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
