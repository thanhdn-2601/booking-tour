import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { AdminListUsersQueryDto } from '../users/dto/admin-list-users-query.dto';
import { UpdateUserRoleDto } from '../users/dto/update-user-role.dto';
import { UpdateUserStatusDto } from '../users/dto/update-user-status.dto';
import { UserRole } from '../users/user-role.enum';
import { AdminUsersService } from './admin-users.service';
import { AdminUserDetailResponse } from './interfaces/admin-user-detail-response.interface';
import { AdminUserListItemResponse } from './interfaces/admin-user-list-item-response.interface';
import { UpdateUserRoleResponse } from './interfaces/update-user-role-response.interface';
import { UpdateUserStatusResponse } from './interfaces/update-user-status-response.interface';

@ApiTags('admin-users')
@ApiSecurity('bearer')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @ApiOperation({ summary: 'List users' })
  @Get()
  list(
    @Query() query: AdminListUsersQueryDto,
  ): Promise<PaginatedResponse<AdminUserListItemResponse>> {
    return this.adminUsersService.list(query);
  }

  @ApiOperation({ summary: 'Get a user by id' })
  @Get(':userId')
  getById(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<AdminUserDetailResponse> {
    return this.adminUsersService.getById(userId);
  }

  @ApiOperation({ summary: "Update a user's status" })
  @Patch(':userId/status')
  updateStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UpdateUserStatusResponse> {
    return this.adminUsersService.updateStatus(userId, dto.status);
  }

  @ApiOperation({ summary: "Update a user's role" })
  @Patch(':userId/role')
  updateRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UpdateUserRoleResponse> {
    return this.adminUsersService.updateRole(userId, dto.role);
  }
}
