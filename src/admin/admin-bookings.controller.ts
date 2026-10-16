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

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminBookingsService } from '../bookings/admin-bookings.service';
import { AdminListBookingsQueryDto } from '../bookings/dto/admin-list-bookings-query.dto';
import { BookingReasonDto } from '../bookings/dto/booking-reason.dto';
import { AdminBookingDetailResponse } from '../bookings/interfaces/admin-booking-detail-response.interface';
import { AdminBookingListItemResponse } from '../bookings/interfaces/admin-booking-list-item-response.interface';
import { UpdateBookingStatusResponse } from '../bookings/interfaces/update-booking-status-response.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { UserRole } from '../users/user-role.enum';

@ApiTags('admin-bookings')
@ApiSecurity('bearer')
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @ApiOperation({ summary: 'List bookings' })
  @Get()
  list(
    @Query() query: AdminListBookingsQueryDto,
  ): Promise<PaginatedResponse<AdminBookingListItemResponse>> {
    return this.adminBookingsService.findAllForAdmin(query);
  }

  @ApiOperation({ summary: 'Get a booking by id' })
  @Get(':bookingId')
  getById(
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ): Promise<AdminBookingDetailResponse> {
    return this.adminBookingsService.getById(bookingId);
  }

  @ApiOperation({ summary: 'Approve a pending booking' })
  @Post(':bookingId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ): Promise<UpdateBookingStatusResponse> {
    return this.adminBookingsService.approve(bookingId);
  }

  @ApiOperation({ summary: 'Reject a pending booking' })
  @Post(':bookingId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: BookingReasonDto,
  ): Promise<UpdateBookingStatusResponse> {
    return this.adminBookingsService.reject(bookingId, dto.reason);
  }

  @ApiOperation({ summary: 'Cancel a pending or confirmed booking' })
  @Post(':bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: BookingReasonDto,
  ): Promise<UpdateBookingStatusResponse> {
    return this.adminBookingsService.cancel(bookingId, dto.reason);
  }
}
