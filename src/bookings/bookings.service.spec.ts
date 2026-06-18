import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Department } from '../common/enums/department.enum';
import { LocationType } from '../common/enums/location-type.enum';
import {
  BookingRejectedException,
  LocationNotBookableException,
  LocationNotFoundException,
} from '../common/exceptions/domain.exceptions';
import { Location } from '../locations/location.entity';
import { BookingAuditLogger } from './booking-audit.logger';
import { Booking } from './booking.entity';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BOOKING_VALIDATORS,
  BookingValidator,
  ValidationResult,
} from './validators/booking-validator.interface';

class StubValidator implements BookingValidator {
  constructor(public readonly name: string, private readonly result: ValidationResult) {}
  validate(): ValidationResult {
    return this.result;
  }
}

function makeRoom(overrides: Partial<Location> = {}): Location {
  return {
    id: 'room-1',
    name: 'Room',
    locationNumber: 'A-01-01',
    building: 'A',
    type: LocationType.ROOM,
    parentId: null,
    parent: null,
    children: [],
    department: Department.EFM,
    capacity: 8,
    openTimeId: 'ot',
    openTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Location;
}

const dto: CreateBookingDto = {
  locationId: 'room-1',
  department: Department.EFM,
  attendees: 4,
  bookingDate: '2026-06-10',
  startTime: '09:00',
  endTime: '10:00',
};

async function buildService(opts: {
  room: Location | null;
  validators: BookingValidator[];
}) {
  const bookingsRepo = {
    create: jest.fn((data) => data as Booking),
    save: jest.fn(async (data) => ({ id: 'b1', ...data }) as Booking),
    find: jest.fn(),
    findAndCount: jest.fn(async () => [[], 0] as [Booking[], number]),
    findOne: jest.fn(),
  };
  const locationsRepo = { findOne: jest.fn(async () => opts.room) };
  const audit = { recordRejection: jest.fn() };

  const module = await Test.createTestingModule({
    providers: [
      BookingsService,
      { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
      { provide: getRepositoryToken(Location), useValue: locationsRepo },
      { provide: BOOKING_VALIDATORS, useValue: opts.validators },
      { provide: BookingAuditLogger, useValue: audit },
    ],
  }).compile();

  return { service: module.get(BookingsService), bookingsRepo, locationsRepo, audit };
}

describe('BookingsService.create', () => {
  it('persists the booking as CONFIRMED when every validator passes', async () => {
    const { service, bookingsRepo, audit } = await buildService({
      room: makeRoom(),
      validators: [
        new StubValidator('R1', { passed: true }),
        new StubValidator('R2', { passed: true }),
      ],
    });
    const booking = await service.create(dto);
    expect(booking.status).toBe(BookingStatus.CONFIRMED);
    expect(bookingsRepo.save).toHaveBeenCalledTimes(1);
    expect(audit.recordRejection).not.toHaveBeenCalled();
  });

  it('throws 422 with every failure reason and persists nothing when a rule fails', async () => {
    const failingValidators = [
      new StubValidator('R1', { passed: true }),
      new StubValidator('R2', { passed: false, reason: 'too many' }),
      new StubValidator('R3', { passed: false, reason: 'closed' }),
    ];
    const expectedFailures = [
      { rule: 'R2', reason: 'too many' },
      { rule: 'R3', reason: 'closed' },
    ];

    const { service, bookingsRepo, audit } = await buildService({
      room: makeRoom(),
      validators: failingValidators,
    });
    await expect(service.create(dto)).rejects.toBeInstanceOf(BookingRejectedException);
    await expect(service.create(dto)).rejects.toMatchObject({
      response: { failures: expectedFailures },
    });
    expect(bookingsRepo.save).not.toHaveBeenCalled();
    expect(audit.recordRejection).toHaveBeenCalledWith(dto, expectedFailures);
  });

  it('throws LocationNotFoundException when the room does not exist', async () => {
    const { service } = await buildService({ room: null, validators: [] });
    await expect(service.create(dto)).rejects.toBeInstanceOf(LocationNotFoundException);
  });

  it('throws LocationNotBookableException for non-ROOM nodes', async () => {
    const { service } = await buildService({
      room: makeRoom({ type: LocationType.FLOOR }),
      validators: [],
    });
    await expect(service.create(dto)).rejects.toBeInstanceOf(LocationNotBookableException);
  });
});

describe('BookingsService.findAll', () => {
  it('applies skip/take and wraps the result with pagination meta', async () => {
    const { service, bookingsRepo } = await buildService({ room: null, validators: [] });
    bookingsRepo.findAndCount.mockResolvedValueOnce([
      [{ id: 'b1' } as Booking, { id: 'b2' } as Booking],
      42,
    ]);

    const result = await service.findAll({
      page: 3,
      limit: 2,
      status: BookingStatus.CONFIRMED,
    });

    expect(bookingsRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: BookingStatus.CONFIRMED },
      order: { createdAt: 'DESC' },
      skip: 4,
      take: 2,
    });
    expect(result.meta).toEqual({ total: 42, page: 3, limit: 2, totalPages: 21 });
    expect(result.data).toHaveLength(2);
  });
});
