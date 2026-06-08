import { Injectable } from '@nestjs/common';
import { Location } from '../../locations/location.entity';
import { OpenTime } from '../../locations/open-time.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BookingValidator, ValidationResult } from './booking-validator.interface';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Injectable()
export class TimeValidator implements BookingValidator {
  readonly name = 'TimeValidation';

  // This validator checks that the booking's time range is valid and falls within the room's open time.
  validate(booking: CreateBookingDto, room: Location): ValidationResult {
    if (!room.openTime) {
      return { passed: false, reason: 'Room has no open time configured' };
    }

    const start = normalize(booking.startTime);
    const end = normalize(booking.endTime);
    if (start >= end) {
      return { passed: false, reason: 'startTime must be earlier than endTime' };
    }

    if (room.openTime.isAlwaysOpen) {
      return { passed: true };
    }

    const dayCheck = this.checkDay(booking.bookingDate, room.openTime);
    if (!dayCheck.passed) return dayCheck;

    return this.checkHours(start, end, room.openTime);
  }

  private checkDay(bookingDate: string, openTime: OpenTime): ValidationResult {
    const day = new Date(`${bookingDate}T00:00:00Z`).getUTCDay();
    if (Number.isNaN(day)) {
      return { passed: false, reason: `Invalid bookingDate: ${bookingDate}` };
    }
    const { startDay, endDay } = openTime;
    if (startDay == null || endDay == null) {
      return { passed: false, reason: 'Room open time is missing day range' };
    }
    const inRange =
      startDay <= endDay
        ? day >= startDay && day <= endDay
        : day >= startDay || day <= endDay;
    if (!inRange) {
      return {
        passed: false,
        reason: `${DAY_NAMES[day]} is outside the room's open days (${DAY_NAMES[startDay]}-${DAY_NAMES[endDay]})`,
      };
    }
    return { passed: true };
  }

  private checkHours(start: string, end: string, openTime: OpenTime): ValidationResult {
    if (!openTime.startTime || !openTime.endTime) {
      return { passed: false, reason: 'Room open time is missing hour range' };
    }
    const openStart = normalize(openTime.startTime);
    const openEnd = normalize(openTime.endTime);
    if (start < openStart || end > openEnd) {
      return {
        passed: false,
        reason: `Booking ${start}-${end} is outside the room's open hours ${openStart}-${openEnd}`,
      };
    }
    return { passed: true };
  }
}

function normalize(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}
