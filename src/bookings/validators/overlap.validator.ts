import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Location } from '../../locations/location.entity';
import { Booking } from '../booking.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BookingValidator, ValidationResult } from './booking-validator.interface';

@Injectable()
export class OverlapValidator implements BookingValidator {
  readonly name = 'OverlapCheck';

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
  ) {}

  // This validator rejects a booking that overlaps an existing CONFIRMED
  // booking in the same room on the same day. Two ranges overlap when
  // `start < other.end && other.start < end`.
  async validate(booking: CreateBookingDto, _room: Location): Promise<ValidationResult> {
    const start = normalize(booking.startTime);
    const end = normalize(booking.endTime);

    const sameDay = await this.bookings.find({
      where: {
        locationId: booking.locationId,
        bookingDate: booking.bookingDate,
        status: BookingStatus.CONFIRMED,
      },
    });

    const conflict = sameDay.find(
      (b) => start < normalize(b.endTime) && normalize(b.startTime) < end,
    );
    if (conflict) {
      return {
        passed: false,
        reason: `Overlaps existing booking ${conflict.id} (${conflict.startTime}-${conflict.endTime})`,
      };
    }
    return { passed: true };
  }
}

function normalize(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}
