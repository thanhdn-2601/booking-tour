import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import type { UserProfileResponse } from './interfaces/user-profile-response.interface';
import { User } from './user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiSecurity('bearer')
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get the current user profile' })
  @Get()
  getMe(@CurrentUser() user: User): UserProfileResponse {
    return this.usersService.toProfileResponse(user);
  }

  @ApiOperation({ summary: 'Update the current user profile' })
  @Patch()
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateMeDto,
  ): Promise<UserProfileResponse> {
    const updated = await this.usersService.updateProfile(user, dto);
    return this.usersService.toProfileResponse(updated);
  }
}
