import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LocationType } from '../common/enums/location-type.enum';
import {
  DuplicateLocationNumberException,
  InvalidParentException,
  LocationHasChildrenException,
  LocationNotFoundException,
} from '../common/exceptions/domain.exceptions';
import { CreateLocationDto } from './dto/create-location.dto';
import { Location } from './location.entity';
import { LocationsService } from './locations.service';
import { OpenTime } from './open-time.entity';

function buildModule(overrides: {
  locations?: Partial<Record<keyof any, jest.Mock>>;
  openTimes?: Partial<Record<keyof any, jest.Mock>>;
} = {}) {
  const locationsRepo = {
    existsBy: jest.fn(async () => false),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(async () => 0),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'new', ...data })),
    remove: jest.fn(),
    ...overrides.locations,
  };
  const openTimesRepo = {
    create: jest.fn((data) => data),
    delete: jest.fn(),
    ...overrides.openTimes,
  };
  return Test.createTestingModule({
    providers: [
      LocationsService,
      { provide: getRepositoryToken(Location), useValue: locationsRepo },
      { provide: getRepositoryToken(OpenTime), useValue: openTimesRepo },
    ],
  })
    .compile()
    .then((module) => ({
      service: module.get(LocationsService),
      locationsRepo,
      openTimesRepo,
    }));
}

const buildingDto: CreateLocationDto = {
  name: 'Tower A',
  locationNumber: 'A',
  building: 'A',
  type: LocationType.BUILDING,
};

describe('LocationsService.create', () => {
  it('rejects duplicate locationNumber', async () => {
    const { service } = await buildModule({
      locations: { existsBy: jest.fn(async () => true) },
    });
    await expect(service.create(buildingDto)).rejects.toBeInstanceOf(
      DuplicateLocationNumberException,
    );
  });

  it('requires non-BUILDING nodes to have a parent', async () => {
    const { service } = await buildModule();
    await expect(
      service.create({ ...buildingDto, type: LocationType.FLOOR, locationNumber: 'A-01' }),
    ).rejects.toBeInstanceOf(InvalidParentException);
  });

  it('rejects BUILDING nodes that supply a parentId', async () => {
    const { service } = await buildModule();
    await expect(
      service.create({ ...buildingDto, parentId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toBeInstanceOf(InvalidParentException);
  });

  it('rejects when the supplied parent does not exist', async () => {
    const { service } = await buildModule({
      locations: { findOne: jest.fn(async () => null) },
    });
    await expect(
      service.create({
        ...buildingDto,
        type: LocationType.ROOM,
        locationNumber: 'A-01-01',
        parentId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(InvalidParentException);
  });

  it('rejects when the parent is a ROOM', async () => {
    const { service } = await buildModule({
      locations: {
        findOne: jest.fn(async () => ({ id: 'p', type: LocationType.ROOM } as Location)),
      },
    });
    await expect(
      service.create({
        ...buildingDto,
        type: LocationType.ROOM,
        locationNumber: 'A-01-01',
        parentId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(InvalidParentException);
  });

  it('saves a valid root BUILDING', async () => {
    const { service, locationsRepo } = await buildModule();
    await service.create(buildingDto);
    expect(locationsRepo.save).toHaveBeenCalled();
  });
});

describe('LocationsService.remove', () => {
  it('throws when the location does not exist', async () => {
    const { service } = await buildModule({
      locations: { findOne: jest.fn(async () => null) },
    });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(LocationNotFoundException);
  });

  it('blocks deletion when children exist and cascade is false', async () => {
    const { service } = await buildModule({
      locations: {
        findOne: jest.fn(async () => ({ id: 'x' } as Location)),
        count: jest.fn(async () => 2),
      },
    });
    await expect(service.remove('x')).rejects.toBeInstanceOf(LocationHasChildrenException);
  });

  it('removes when cascade is true even with children', async () => {
    const { service, locationsRepo } = await buildModule({
      locations: {
        findOne: jest.fn(async () => ({ id: 'x' } as Location)),
        count: jest.fn(async () => 2),
      },
    });
    await service.remove('x', true);
    expect(locationsRepo.remove).toHaveBeenCalled();
  });
});
