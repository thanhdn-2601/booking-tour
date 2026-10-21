import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewResponse } from './interfaces/create-review-response.interface';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiSecurity('bearer')
@Controller('bookings/:bookingId/review')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({ summary: 'Leave a review for a completed booking' })
  @Post()
  create(
    @CurrentUser() user: User,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: CreateReviewDto,
  ): Promise<CreateReviewResponse> {
    return this.reviewsService.create(user.id, bookingId, dto);
  }
}
