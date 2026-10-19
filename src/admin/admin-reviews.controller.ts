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
import { AdminReviewsService } from '../reviews/admin-reviews.service';
import { AdminListReviewsQueryDto } from '../reviews/dto/admin-list-reviews-query.dto';
import { RejectReviewDto } from '../reviews/dto/reject-review.dto';
import { AdminReviewListItemResponse } from '../reviews/interfaces/admin-review-list-item-response.interface';
import { UpdateReviewStatusResponse } from '../reviews/interfaces/update-review-status-response.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { UserRole } from '../users/user-role.enum';

@ApiTags('admin-reviews')
@ApiSecurity('bearer')
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @ApiOperation({ summary: 'List reviews' })
  @Get()
  list(
    @Query() query: AdminListReviewsQueryDto,
  ): Promise<PaginatedResponse<AdminReviewListItemResponse>> {
    return this.adminReviewsService.findAllForAdmin(query);
  }

  @ApiOperation({ summary: 'Approve a pending review' })
  @Post(':reviewId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('reviewId', ParseIntPipe) reviewId: number,
  ): Promise<UpdateReviewStatusResponse> {
    return this.adminReviewsService.approve(reviewId);
  }

  @ApiOperation({ summary: 'Reject a pending review' })
  @Post(':reviewId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Body() dto: RejectReviewDto,
  ): Promise<UpdateReviewStatusResponse> {
    return this.adminReviewsService.reject(reviewId, dto.reason);
  }
}
