import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Not, Repository } from 'typeorm';

import { collectValidationErrors } from '../common/collect-validation-errors';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.usersRepository.exists({
      where: { email: email.toLowerCase() },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByActivationTokenHash(activationTokenHash: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { activationTokenHash } });
  }

  async create(data: CreateUserDto): Promise<User> {
    const dto = plainToInstance(CreateUserDto, data);
    const errors = await validate(dto);
    if (errors.length) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        errors: collectValidationErrors(errors),
      });
    }

    const user = this.usersRepository.create({
      email: dto.email.toLowerCase(),
      password: dto.password,
      fullName: dto.fullName,
      phone: dto.phone,
      role: UserRole.USER,
      status: UserStatus.INACTIVE,
      emailVerifiedAt: null,
      activationTokenHash: dto.activationTokenHash,
      activationTokenExpiresAt: dto.activationTokenExpiresAt,
    });
    return this.usersRepository.save(user);
  }

  updateProfile(user: User, dto: UpdateMeDto): Promise<User> {
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    return this.usersRepository.save(user);
  }

  // Conditional on status to make concurrent activation attempts safe: only one wins.
  async activateIfPending(
    userId: number,
    emailVerifiedAt: Date,
  ): Promise<boolean> {
    const result = await this.usersRepository.update(
      { id: userId, status: Not(UserStatus.ACTIVE) },
      { status: UserStatus.ACTIVE, emailVerifiedAt },
    );
    return !!result.affected;
  }
}
