import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource } from 'typeorm';

import { AuthService } from '../auth/auth.service';
import { AdminListUsersQueryDto } from '../users/dto/admin-list-users-query.dto';
import { UserStatus } from '../users/user-status.enum';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { AdminUserDetailResponse } from './interfaces/admin-user-detail-response.interface';
import { AdminUserListItemResponse } from './interfaces/admin-user-list-item-response.interface';
import { UpdateUserRoleResponse } from './interfaces/update-user-role-response.interface';
import { UpdateUserStatusResponse } from './interfaces/update-user-status-response.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(
    query: AdminListUsersQueryDto,
  ): Promise<PaginatedResponse<AdminUserListItemResponse>> {
    const { page, pageSize } = query;
    const { items, total } = await this.usersService.findAllForAdmin(query);
    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(userId: number): Promise<AdminUserDetailResponse> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: this.i18n.t('users.user_not_found'),
      });
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  async updateStatus(
    userId: number,
    status: UserStatus,
  ): Promise<UpdateUserStatusResponse> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const result = await this.usersService.updateStatus(
        userId,
        status,
        manager,
      );
      if (result.kind === 'ok' && status === UserStatus.INACTIVE) {
        await this.authService.revokeAllSessions(userId, manager);
      }
      return result;
    });
    if (outcome.kind === 'not_found') {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: this.i18n.t('users.user_not_found'),
      });
    }
    if (outcome.kind === 'unchanged') {
      throw new ConflictException({
        code: 'STATUS_UNCHANGED',
        message: this.i18n.t('users.status_unchanged'),
      });
    }

    return {
      id: outcome.id,
      status: outcome.status,
      updatedAt: outcome.updatedAt,
    };
  }

  async updateRole(
    userId: number,
    role: UserRole,
  ): Promise<UpdateUserRoleResponse> {
    const result = await this.usersService.updateRole(userId, role);
    if (!result) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: this.i18n.t('users.user_not_found'),
      });
    }
    return result;
  }
}
