import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationType } from '../common/enums/location-type.enum';
import {
  DuplicateLocationNumberException,
  InvalidParentException,
  LocationHasChildrenException,
  LocationNotFoundException,
} from '../common/exceptions/domain.exceptions';
import { CreateLocationDto } from './dto/create-location.dto';
import { OpenTimeDto } from './dto/open-time.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Location } from './location.entity';
import { OpenTime } from './open-time.entity';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(OpenTime) private readonly openTimes: Repository<OpenTime>,
  ) {}

  async create(dto: CreateLocationDto): Promise<Location> {
    if (await this.locations.existsBy({ locationNumber: dto.locationNumber })) {
      throw new DuplicateLocationNumberException(dto.locationNumber);
    }

    if (dto.parentId) {
      if (dto.type === LocationType.BUILDING) {
        throw new InvalidParentException('BUILDING nodes cannot have a parent');
      }
      const parent = await this.locations.findOne({ where: { id: dto.parentId } });
      if (!parent) {
        throw new InvalidParentException(`Parent ${dto.parentId} does not exist`);
      }
      if (parent.type === LocationType.ROOM) {
        throw new InvalidParentException('A ROOM cannot have children');
      }
    } else if (dto.type !== LocationType.BUILDING) {
      throw new InvalidParentException('Only BUILDING nodes may be root-level');
    }

    const location = this.locations.create({
      name: dto.name,
      locationNumber: dto.locationNumber,
      building: dto.building,
      type: dto.type,
      parentId: dto.parentId ?? null,
      department: dto.department ?? null,
      capacity: dto.capacity ?? null,
      openTime: dto.openTime ? this.buildOpenTime(dto.openTime) : null,
    });

    const saved = await this.locations.save(location);
    this.logger.log(`Created ${saved.type} ${saved.locationNumber} (${saved.id})`);
    return saved;
  }

  async findOne(id: string): Promise<Location> {
    const found = await this.locations.findOne({
      where: { id },
      relations: { openTime: true },
    });
    if (!found) throw new LocationNotFoundException(id);
    return found;
  }

  async findTree(): Promise<Location[]> {
    const all = await this.locations.find({
      order: { locationNumber: 'ASC' },
    });
    return this.assembleTree(all);
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.locations.findOne({
      where: { id },
      relations: { openTime: true },
    });
    if (!location) throw new LocationNotFoundException(id);

    if (dto.name !== undefined) location.name = dto.name;
    if (dto.department !== undefined) location.department = dto.department ?? null;
    if (dto.capacity !== undefined) location.capacity = dto.capacity ?? null;

    if (dto.openTime !== undefined) {
      if (dto.openTime === null) {
        if (location.openTime) await this.openTimes.delete(location.openTime.id);
        location.openTime = null;
        location.openTimeId = null;
      } else if (location.openTime) {
        Object.assign(location.openTime, this.normalizeOpenTime(dto.openTime));
      } else {
        location.openTime = this.buildOpenTime(dto.openTime);
      }
    }

    return this.locations.save(location);
  }

  async remove(id: string, cascade = false): Promise<void> {
    const location = await this.locations.findOne({ where: { id } });
    if (!location) throw new LocationNotFoundException(id);

    const childCount = await this.locations.count({ where: { parentId: id } });
    if (childCount > 0 && !cascade) {
      throw new LocationHasChildrenException(id);
    }

    await this.locations.remove(location);
    this.logger.log(
      `Removed ${location.type} ${location.locationNumber} (${id})${cascade ? ' [cascade]' : ''}`,
    );
  }

  private buildOpenTime(dto: OpenTimeDto): OpenTime {
    return this.openTimes.create(this.normalizeOpenTime(dto));
  }

  private normalizeOpenTime(dto: OpenTimeDto): Partial<OpenTime> {
    if (dto.isAlwaysOpen) {
      return {
        isAlwaysOpen: true,
        startDay: null,
        endDay: null,
        startTime: null,
        endTime: null,
      };
    }
    return {
      isAlwaysOpen: false,
      startDay: dto.startDay ?? null,
      endDay: dto.endDay ?? null,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
    };
  }

  private assembleTree(nodes: Location[]): Location[] {
    const byId = new Map<string, Location & { children: Location[] }>();
    for (const node of nodes) {
      byId.set(node.id, Object.assign(node, { children: [] }));
    }

    const roots: Location[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }
}
