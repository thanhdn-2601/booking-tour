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
import { AdminListTourTimesQueryDto } from '../tours/dto/admin-list-tour-times-query.dto';
import { CreateTourTimeDto } from '../tours/dto/create-tour-time.dto';
import { UpdateTourTimeDto } from '../tours/dto/update-tour-time.dto';
import { AdminTourTimeListItemResponse } from '../tours/interfaces/admin-tour-time-list-item-response.interface';
import { CreateTourTimeResponse } from '../tours/interfaces/create-tour-time-response.interface';
import { UpdateTourTimeResponse } from '../tours/interfaces/update-tour-time-response.interface';
import { TourTimesService } from '../tours/tour-times.service';
import { UserRole } from '../users/user-role.enum';

@ApiTags('admin-tour-times')
@ApiSecurity('bearer')
@Controller('admin/tours/:tourId/times')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTourTimesController {
  constructor(private readonly tourTimesService: TourTimesService) {}

  @ApiOperation({ summary: 'Create a tour time' })
  @Post()
  create(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Body() dto: CreateTourTimeDto,
  ): Promise<CreateTourTimeResponse> {
    return this.tourTimesService.create(tourId, dto);
  }

  @ApiOperation({ summary: "List a tour's tour times" })
  @Get()
  list(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Query() query: AdminListTourTimesQueryDto,
  ): Promise<PaginatedResponse<AdminTourTimeListItemResponse>> {
    return this.tourTimesService.findAllForTour(tourId, query);
  }

  @ApiOperation({ summary: 'Update a tour time' })
  @Patch(':timeId')
  update(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Param('timeId', ParseIntPipe) timeId: number,
    @Body() dto: UpdateTourTimeDto,
  ): Promise<UpdateTourTimeResponse> {
    return this.tourTimesService.update(tourId, timeId, dto);
  }

  @ApiOperation({ summary: 'Delete a tour time' })
  @Delete(':timeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Param('timeId', ParseIntPipe) timeId: number,
  ): Promise<void> {
    return this.tourTimesService.remove(tourId, timeId);
  }
}
