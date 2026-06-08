import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module';
import { Booking } from './booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CapacityValidator } from './validators/capacity.validator';
import { DepartmentValidator } from './validators/department.validator';
import { TimeValidator } from './validators/time.validator';
import { BOOKING_VALIDATORS } from './validators/booking-validator.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), LocationsModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    DepartmentValidator,
    CapacityValidator,
    TimeValidator,
    {
      provide: BOOKING_VALIDATORS,
      inject: [DepartmentValidator, CapacityValidator, TimeValidator],
      useFactory: (
        dept: DepartmentValidator,
        cap: CapacityValidator,
        time: TimeValidator,
      ) => [dept, cap, time],
    },
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
