import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TourTime } from '../tours/tour-time.entity';
import { User } from '../users/user.entity';
import { BookingStatus } from './booking-status.enum';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'tour_time_id' })
  tourTimeId: number;

  @ManyToOne(() => TourTime, (tourTime) => tourTime.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tour_time_id' })
  tourTime: TourTime;

  @Column({ name: 'number_of_slots', type: 'int' })
  numberOfSlots: number;

  @Column({ name: 'total_price', type: 'int' })
  totalPrice: number;

  @Column({ type: 'varchar' })
  status: BookingStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
