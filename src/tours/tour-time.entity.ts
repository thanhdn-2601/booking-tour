import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Booking } from '../bookings/booking.entity';
import { TourTimeStatus } from './tour-time-status.enum';
import { Tour } from './tour.entity';

@Entity('tour_times')
export class TourTime {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tour_id' })
  tourId: number;

  @ManyToOne(() => Tour, (tour) => tour.tourTimes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tour_id' })
  tour: Tour;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'int' })
  price: number;

  @Column({ name: 'max_capacity', type: 'int' })
  maxCapacity: number;

  @Column({ type: 'varchar', default: TourTimeStatus.OPEN })
  status: TourTimeStatus;

  @OneToMany(() => Booking, (booking) => booking.tourTime)
  bookings: Booking[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
