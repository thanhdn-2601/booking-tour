import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tour } from '../tours/tour.entity';
import { Category } from './category.entity';
import { CategoriesService } from './categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Tour])],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
