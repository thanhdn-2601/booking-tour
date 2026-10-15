import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { CategoriesService } from './categories.service';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { CategoryListItemResponse } from './interfaces/category-list-item-response.interface';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'List categories' })
  @Get()
  list(
    @Query() query: ListCategoriesQueryDto,
  ): Promise<PaginatedResponse<CategoryListItemResponse>> {
    return this.categoriesService.findAllPublic(query);
  }
}
