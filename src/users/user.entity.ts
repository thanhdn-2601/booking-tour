import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  // Defaults to INACTIVE, not ACTIVE: the app's invariant is that an account
  // only becomes active by going through email activation (see AuthService).
  @Column({ type: 'varchar', default: UserStatus.INACTIVE })
  status: UserStatus;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({
    name: 'activation_token_hash',
    type: 'varchar',
    nullable: true,
  })
  activationTokenHash: string | null;

  @Column({
    name: 'activation_token_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  activationTokenExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
