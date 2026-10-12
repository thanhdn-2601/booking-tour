import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Tour } from './tour.entity';

// Minimal stub ahead of the Tour Times feature — just enough to back
// ADMIN-TOUR-05's "has no tour time" publish guard and ADMIN-TOUR-06's
// ON DELETE RESTRICT. Expect this table to gain real columns (startDate,
// endDate, price, maxCapacity, ...) once that feature is built.
@Entity('tour_times')
export class TourTime {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tour_id' })
  tourId: number;

  @ManyToOne(() => Tour, (tour) => tour.tourTimes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tour_id' })
  tour: Tour;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
