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
import { CategoriesService } from '../categories/categories.service';
import { AdminListCategoriesQueryDto } from '../categories/dto/admin-list-categories-query.dto';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';
import { AdminCategoryListItemResponse } from '../categories/interfaces/admin-category-list-item-response.interface';
import { CategoryResponse } from '../categories/interfaces/category-response.interface';
import { UpdateCategoryResponse } from '../categories/interfaces/update-category-response.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { UserRole } from '../users/user-role.enum';

@ApiTags('admin-categories')
@ApiSecurity('bearer')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Create a category' })
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponse> {
    return this.categoriesService.create(dto);
  }

  @ApiOperation({ summary: 'List categories' })
  @Get()
  list(
    @Query() query: AdminListCategoriesQueryDto,
  ): Promise<PaginatedResponse<AdminCategoryListItemResponse>> {
    return this.categoriesService.findAllForAdmin(query);
  }

  @ApiOperation({ summary: 'Update a category' })
  @Patch(':categoryId')
  update(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<UpdateCategoryResponse> {
    return this.categoriesService.update(categoryId, dto);
  }

  @ApiOperation({ summary: 'Delete a category' })
  @Delete(':categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('categoryId', ParseIntPipe) categoryId: number): Promise<void> {
    return this.categoriesService.remove(categoryId);
  }
}
