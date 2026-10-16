import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { ListTourTimesQueryDto } from './dto/list-tour-times-query.dto';
import { ListToursQueryDto } from './dto/list-tours-query.dto';
import { PublicTourTimeListItemResponse } from './interfaces/public-tour-time-list-item-response.interface';
import { TourDetailResponse } from './interfaces/tour-detail-response.interface';
import { TourListItemResponse } from './interfaces/tour-list-item-response.interface';
import { TourTimesService } from './tour-times.service';
import { ToursService } from './tours.service';

@ApiTags('tours')
@Controller('tours')
export class ToursController {
  constructor(
    private readonly toursService: ToursService,
    private readonly tourTimesService: TourTimesService,
  ) {}

  @ApiOperation({ summary: 'List published tours' })
  @Get()
  list(
    @Query() query: ListToursQueryDto,
  ): Promise<PaginatedResponse<TourListItemResponse>> {
    return this.toursService.findAllPublic(query);
  }

  @ApiOperation({ summary: 'Get a published tour by id' })
  @Get(':tourId')
  getById(
    @Param('tourId', ParseIntPipe) tourId: number,
  ): Promise<TourDetailResponse> {
    return this.toursService.getByIdPublic(tourId);
  }

  @ApiOperation({ summary: 'List bookable times for a published tour' })
  @Get(':tourId/times')
  listTimes(
    @Param('tourId', ParseIntPipe) tourId: number,
    @Query() query: ListTourTimesQueryDto,
  ): Promise<PaginatedResponse<PublicTourTimeListItemResponse>> {
    return this.tourTimesService.findAllForTourPublic(tourId, query);
  }
}
