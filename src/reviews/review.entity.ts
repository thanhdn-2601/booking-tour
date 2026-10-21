import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Booking } from '../bookings/booking.entity';
import { ReviewStatus } from './review-status.enum';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'booking_id', unique: true })
  bookingId: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ type: 'int' })
  rating: number;

  @Column()
  comment: string;

  @Column({ type: 'varchar', default: ReviewStatus.PENDING })
  status: ReviewStatus;

  // Set only on reject — kept for traceability, not surfaced in any
  // response shape the sheet documents today.
  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
