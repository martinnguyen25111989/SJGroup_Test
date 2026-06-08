import { Department } from '../../common/enums/department.enum';
import { LocationType } from '../../common/enums/location-type.enum';
import { Location } from '../../locations/location.entity';
import { OpenTime } from '../../locations/open-time.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { CapacityValidator } from './capacity.validator';
import { DepartmentValidator } from './department.validator';
import { TimeValidator } from './time.validator';

function makeRoom(overrides: Partial<Location> = {}): Location {
  const openTime: OpenTime = {
    id: 'ot',
    isAlwaysOpen: false,
    startDay: 1,
    endDay: 5,
    startTime: '09:00:00',
    endTime: '18:00:00',
  };
  return {
    id: 'loc',
    name: 'Room 1',
    locationNumber: 'A-01-01',
    building: 'A',
    type: LocationType.ROOM,
    parentId: null,
    parent: null,
    children: [],
    department: Department.EFM,
    capacity: 8,
    openTimeId: 'ot',
    openTime,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Location;
}

function makeBooking(overrides: Partial<CreateBookingDto> = {}): CreateBookingDto {
  return {
    locationId: 'loc',
    department: Department.EFM,
    attendees: 4,
    bookingDate: '2026-06-10', // Wednesday
    startTime: '10:00',
    endTime: '11:00',
    ...overrides,
  };
}

describe('DepartmentValidator', () => {
  const validator = new DepartmentValidator();

  it('passes when departments match', () => {
    expect(validator.validate(makeBooking(), makeRoom()).passed).toBe(true);
  });

  it('fails when departments differ', () => {
    const result = validator.validate(
      makeBooking({ department: Department.FSS }),
      makeRoom(),
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/does not match/i);
  });
});

describe('CapacityValidator', () => {
  const validator = new CapacityValidator();

  it('passes when attendees fit', () => {
    expect(validator.validate(makeBooking({ attendees: 8 }), makeRoom()).passed).toBe(true);
  });

  it('fails when attendees exceed capacity', () => {
    const result = validator.validate(makeBooking({ attendees: 9 }), makeRoom());
    expect(result.passed).toBe(false);
  });

  it('fails when room has no capacity', () => {
    const result = validator.validate(makeBooking(), makeRoom({ capacity: null }));
    expect(result.passed).toBe(false);
  });
});

describe('TimeValidator', () => {
  const validator = new TimeValidator();

  it('passes within open hours on an open day', () => {
    expect(validator.validate(makeBooking(), makeRoom()).passed).toBe(true);
  });

  it('rejects bookings on closed days', () => {
    const saturday = makeBooking({ bookingDate: '2026-06-13' });
    const result = validator.validate(saturday, makeRoom());
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/outside the room/i);
  });

  it('rejects bookings outside open hours', () => {
    const result = validator.validate(
      makeBooking({ startTime: '08:00', endTime: '09:30' }),
      makeRoom(),
    );
    expect(result.passed).toBe(false);
  });

  it('rejects when start >= end', () => {
    const result = validator.validate(
      makeBooking({ startTime: '11:00', endTime: '11:00' }),
      makeRoom(),
    );
    expect(result.passed).toBe(false);
  });

  it('allows any time on an always-open room', () => {
    const room = makeRoom({
      openTime: {
        id: 'ot',
        isAlwaysOpen: true,
        startDay: null,
        endDay: null,
        startTime: null,
        endTime: null,
      },
    });
    const result = validator.validate(
      makeBooking({ bookingDate: '2026-06-13', startTime: '23:00', endTime: '23:59' }),
      room,
    );
    expect(result.passed).toBe(true);
  });

  it('handles wraparound day ranges (Sat to Mon)', () => {
    const room = makeRoom({
      openTime: {
        id: 'ot',
        isAlwaysOpen: false,
        startDay: 6,
        endDay: 1,
        startTime: '09:00:00',
        endTime: '18:00:00',
      },
    });
    // 2026-06-10 is Wednesday — should be rejected
    expect(validator.validate(makeBooking(), room).passed).toBe(false);
    // 2026-06-14 is Sunday — should pass
    expect(
      validator.validate(makeBooking({ bookingDate: '2026-06-14' }), room).passed,
    ).toBe(true);
  });
});
