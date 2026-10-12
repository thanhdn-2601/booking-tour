import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { ToursModule } from '../tours/tours.module';
import { UsersModule } from '../users/users.module';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminToursController } from './admin-tours.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [UsersModule, AuthModule, CategoriesModule, ToursModule],
  controllers: [
    AdminUsersController,
    AdminCategoriesController,
    AdminToursController,
  ],
  providers: [AdminUsersService],
})
export class AdminModule {}
