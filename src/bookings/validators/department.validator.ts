import { Injectable } from '@nestjs/common';
import { Location } from '../../locations/location.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BookingValidator, ValidationResult } from './booking-validator.interface';

@Injectable()
export class DepartmentValidator implements BookingValidator {
  readonly name = 'DepartmentMatching';

  // This validator checks that the booking's department matches the room's department (if set).
  validate(booking: CreateBookingDto, room: Location): ValidationResult {
    if (room.department !== booking.department) {
      return {
        passed: false,
        reason: `Department ${booking.department} does not match room department ${room.department ?? 'none'}`,
      };
    }
    return { passed: true };
  }
}
