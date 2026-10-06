import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository, UpdateResult } from 'typeorm';

import { isUniqueViolation } from '../common/postgres-errors';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { Category } from './category.entity';
import { AdminListCategoriesQueryDto } from './dto/admin-list-categories-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AdminCategoryListItemResponse } from './interfaces/admin-category-list-item-response.interface';
import { CategoryResponse } from './interfaces/category-response.interface';
import { UpdateCategoryResponse } from './interfaces/update-category-response.interface';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    const category = this.categoriesRepository.create({
      name: dto.name,
      description: dto.description,
    });
    try {
      const saved = await this.categoriesRepository.save(category);
      return { id: saved.id, name: saved.name, description: saved.description };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'CATEGORY_NAME_EXISTS',
          message: this.i18n.t('categories.category_name_exists'),
        });
      }
      throw error;
    }
  }

  async findAllForAdmin(
    query: AdminListCategoriesQueryDto,
  ): Promise<PaginatedResponse<AdminCategoryListItemResponse>> {
    const { search, page, pageSize } = query;

    const countQuery = this.categoriesRepository.createQueryBuilder('category');
    const listQuery = this.categoriesRepository
      .createQueryBuilder('category')
      .leftJoin('category.tours', 'tour')
      .select('category.id', 'id')
      .addSelect('category.name', 'name')
      .addSelect('COUNT(tour.id)', 'tourCount')
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('category.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (search) {
      countQuery.andWhere('category.name ILIKE :search', {
        search: `%${search}%`,
      });
      listQuery.andWhere('category.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const [total, rows] = await Promise.all([
      countQuery.getCount(),
      listQuery.getRawMany<{ id: number; name: string; tourCount: string }>(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        tourCount: Number(row.tourCount),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async update(
    categoryId: number,
    dto: UpdateCategoryDto,
  ): Promise<UpdateCategoryResponse> {
    let result: UpdateResult;
    try {
      result = await this.categoriesRepository.update(categoryId, {
        name: dto.name,
        description: dto.description,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'CATEGORY_NAME_EXISTS',
          message: this.i18n.t('categories.category_name_exists'),
        });
      }
      throw error;
    }
    if (!result.affected) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: this.i18n.t('categories.category_not_found'),
      });
    }
    return { id: categoryId, name: dto.name };
  }

  async remove(categoryId: number): Promise<void> {
    const result = await this.categoriesRepository.delete(categoryId);
    if (!result.affected) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: this.i18n.t('categories.category_not_found'),
      });
    }
  }
}
