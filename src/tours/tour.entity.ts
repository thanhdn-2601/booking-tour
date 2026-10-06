import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Category } from '../categories/category.entity';

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
