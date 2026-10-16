import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UserListBookingsQueryDto } from './dto/user-list-bookings-query.dto';
import { CreateBookingResponse } from './interfaces/create-booking-response.interface';
import { UpdateBookingStatusResponse } from './interfaces/update-booking-status-response.interface';
import { UserBookingDetailResponse } from './interfaces/user-booking-detail-response.interface';
import { UserBookingListItemResponse } from './interfaces/user-booking-list-item-response.interface';

@ApiTags('bookings')
@ApiSecurity('bearer')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @ApiOperation({ summary: 'Create a booking' })
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateBookingDto,
  ): Promise<CreateBookingResponse> {
    return this.bookingsService.createBooking(user.id, dto);
  }

  @ApiOperation({ summary: "List the current user's bookings" })
  @Get()
  list(
    @CurrentUser() user: User,
    @Query() query: UserListBookingsQueryDto,
  ): Promise<PaginatedResponse<UserBookingListItemResponse>> {
    return this.bookingsService.findAllForUser(user.id, query);
  }

  @ApiOperation({ summary: 'Get a booking owned by the current user' })
  @Get(':bookingId')
  getById(
    @CurrentUser() user: User,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ): Promise<UserBookingDetailResponse> {
    return this.bookingsService.getByIdForUser(user.id, bookingId);
  }

  @ApiOperation({
    summary: 'Cancel a pending booking owned by the current user',
  })
  @Post(':bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: User,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ): Promise<UpdateBookingStatusResponse> {
    return this.bookingsService.cancelForUser(user.id, bookingId);
  }
}
