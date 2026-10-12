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

import { Category } from '../categories/category.entity';
import { TourStatus } from './tour-status.enum';
import { TourTime } from './tour-time.entity';

@Entity('tours')
export class Tour {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, (category) => category.tours, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column()
  title: string;

  @Column()
  description: string;

  // New tours default to draft until an admin explicitly publishes them.
  @Column({ type: 'varchar', default: TourStatus.DRAFT })
  status: TourStatus;

  @OneToMany(() => TourTime, (tourTime) => tourTime.tour)
  tourTimes: TourTime[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
