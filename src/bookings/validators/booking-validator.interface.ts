import { Location } from '../../locations/location.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';

export interface ValidationResult {
  passed: boolean;
  reason?: string;
}

export interface BookingValidator {
  readonly name: string;
  validate(
    booking: CreateBookingDto,
    room: Location,
  ): ValidationResult | Promise<ValidationResult>;
}

export const BOOKING_VALIDATORS = Symbol('BOOKING_VALIDATORS');
