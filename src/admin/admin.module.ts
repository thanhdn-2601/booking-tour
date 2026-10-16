import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CategoriesModule } from '../categories/categories.module';
import { ToursModule } from '../tours/tours.module';
import { UsersModule } from '../users/users.module';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminTourImagesController } from './admin-tour-images.controller';
import { AdminTourTimesController } from './admin-tour-times.controller';
import { AdminToursController } from './admin-tours.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    CategoriesModule,
    ToursModule,
    BookingsModule,
  ],
  controllers: [
    AdminUsersController,
    AdminCategoriesController,
    AdminToursController,
    AdminTourImagesController,
    AdminTourTimesController,
    AdminBookingsController,
  ],
  providers: [AdminUsersService],
})
export class AdminModule {}
