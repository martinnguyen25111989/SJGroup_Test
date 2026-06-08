import { Injectable } from '@nestjs/common';
import { Location } from '../../locations/location.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BookingValidator, ValidationResult } from './booking-validator.interface';

@Injectable()
export class CapacityValidator implements BookingValidator {
  readonly name = 'CapacityCheck';

  // This validator checks that the number of attendees does not exceed the room's capacity.
  validate(booking: CreateBookingDto, room: Location): ValidationResult {
    if (room.capacity == null) {
      return { passed: false, reason: 'Room has no capacity defined' };
    }
    if (booking.attendees > room.capacity) {
      return {
        passed: false,
        reason: `Attendees ${booking.attendees} exceed room capacity ${room.capacity}`,
      };
    }
    return { passed: true };
  }
}
