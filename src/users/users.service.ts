import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntityManager, ILike, Not, Repository } from 'typeorm';

import { collectValidationErrors } from '../common/collect-validation-errors';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { AdminUsersQueryResult } from './interfaces/admin-users-query-result.interface';
import { UpdateRoleResult } from './interfaces/update-role-result.interface';
import { UpdateStatusOutcome } from './interfaces/update-status-outcome.interface';
import { UserProfileResponse } from './interfaces/user-profile-response.interface';
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
      select: { id: true, password: true, status: true },
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
    return this.usersRepository.findOne({
      where: { activationTokenHash },
      select: { id: true, activationTokenExpiresAt: true },
    });
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

  toProfileResponse(user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
  }

  async findAllForAdmin(
    query: AdminListUsersQueryDto,
  ): Promise<AdminUsersQueryResult> {
    const { search, role, status, page, pageSize } = query;
    const baseWhere = { ...(role && { role }), ...(status && { status }) };
    const where = search
      ? [
          { ...baseWhere, email: ILike(`%${search}%`) },
          { ...baseWhere, fullName: ILike(`%${search}%`) },
        ]
      : baseWhere;

    const [items, total] = await this.usersRepository.findAndCount({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { id: 'ASC' },
    });
    return { items, total };
  }

  async updateStatus(
    userId: number,
    status: UserStatus,
    manager?: EntityManager,
  ): Promise<UpdateStatusOutcome> {
    const usersRepository = manager
      ? manager.getRepository(User)
      : this.usersRepository;
    const updatedAt = new Date();
    const result = await usersRepository.update(
      { id: userId, status: Not(status) },
      { status, updatedAt },
    );
    if (result.affected) {
      return { kind: 'ok', id: userId, status, updatedAt };
    }
    const exists = await usersRepository.exists({ where: { id: userId } });
    return { kind: exists ? 'unchanged' : 'not_found' };
  }

  async updateRole(
    userId: number,
    role: UserRole,
  ): Promise<UpdateRoleResult | null> {
    const updatedAt = new Date();
    const result = await this.usersRepository.update(
      { id: userId },
      { role, updatedAt },
    );
    if (!result.affected) return null;
    return { id: userId, role, updatedAt };
  }

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
