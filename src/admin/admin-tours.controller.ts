import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { AdminListToursQueryDto } from '../tours/dto/admin-list-tours-query.dto';
import { CreateTourDto } from '../tours/dto/create-tour.dto';
import { UpdateTourStatusDto } from '../tours/dto/update-tour-status.dto';
import { UpdateTourDto } from '../tours/dto/update-tour.dto';
import { AdminTourDetailResponse } from '../tours/interfaces/admin-tour-detail-response.interface';
import { AdminTourListItemResponse } from '../tours/interfaces/admin-tour-list-item-response.interface';
import { CreateTourResponse } from '../tours/interfaces/create-tour-response.interface';
import { UpdateTourResponse } from '../tours/interfaces/update-tour-response.interface';
import { UpdateTourStatusResponse } from '../tours/interfaces/update-tour-status-response.interface';
import { ToursService } from '../tours/tours.service';
import { UserRole } from '../users/user-role.enum';

@ApiTags('admin-tours')
@ApiSecurity('bearer')
@Controller('admin/tours')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminToursController {
  constructor(private readonly toursService: ToursService) {}

  @ApiOperation({ summary: 'Create a tour' })
  @Post()
  create(@Body() dto: CreateTourDto): Promise<CreateTourResponse> {
    return this.toursService.create(dto);
  }

  @ApiOperation({ summary: 'List tours' })
  @Get()
  list(
    @Query() query: AdminListToursQueryDto,
  ): Promise<PaginatedResponse<AdminTourListItemResponse>> {
    return this.toursService.findAllForAdmin(query);
  }

  @ApiOperation({ summary: 'Get a tour by id' })
  @Get(':tourId')
  getById(
    @Param('tourId', ParseIntPipe) tourId: number,
  ): Promise<AdminTourDetailResponse> {
    return this.toursService.getById(tourId);
  }

  @ApiOperation({ summary: 'Update a tour' })
  @Patch(':tourId')
  update(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Body() dto: UpdateTourDto,
  ): Promise<UpdateTourResponse> {
    return this.toursService.update(tourId, dto);
  }

  @ApiOperation({ summary: "Update a tour's status" })
  @Patch(':tourId/status')
  updateStatus(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Body() dto: UpdateTourStatusDto,
  ): Promise<UpdateTourStatusResponse> {
    return this.toursService.updateStatus(tourId, dto.status);
  }

  @ApiOperation({ summary: 'Delete a tour' })
  @Delete(':tourId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('tourId', ParseIntPipe) tourId: number): Promise<void> {
    return this.toursService.remove(tourId);
  }
}
