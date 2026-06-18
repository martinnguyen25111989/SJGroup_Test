import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { LocationType } from '../common/enums/location-type.enum';
import {
  BookingNotFoundException,
  LocationNotBookableException,
  LocationNotFoundException,
} from '../common/exceptions/domain.exceptions';
import { Location } from '../locations/location.entity';
import { Booking } from './booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import {
  BOOKING_VALIDATORS,
  BookingValidator,
} from './validators/booking-validator.interface';

export interface BookingResult {
  booking: Booking;
  failures: { rule: string; reason: string }[];
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @Inject(BOOKING_VALIDATORS) private readonly validators: BookingValidator[],
  ) {}

  async create(dto: CreateBookingDto): Promise<BookingResult> {
    const room = await this.locations.findOne({
      where: { id: dto.locationId },
      relations: { openTime: true },
    });
    if (!room) throw new LocationNotFoundException(dto.locationId);
    if (room.type !== LocationType.ROOM) {
      throw new LocationNotBookableException(dto.locationId);
    }

    const failures: { rule: string; reason: string }[] = [];
    for (const validator of this.validators) {
      const result = await validator.validate(dto, room);
      if (!result.passed) {
        failures.push({ rule: validator.name, reason: result.reason ?? 'failed' });
      }
    }

    const booking = this.bookings.create({
      locationId: dto.locationId,
      department: dto.department,
      attendees: dto.attendees,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: failures.length === 0 ? BookingStatus.CONFIRMED : BookingStatus.REJECTED,
    });

    const saved = await this.bookings.save(booking);
    return { booking: saved, failures };
  }

  findAll(query: QueryBookingsDto): Promise<Booking[]> {
    const where: FindOptionsWhere<Booking> = {};
    if (query.locationId) where.locationId = query.locationId;
    if (query.bookingDate) where.bookingDate = query.bookingDate;
    if (query.status) where.status = query.status;
    return this.bookings.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new BookingNotFoundException(id);
    return booking;
  }
}
