import { Department } from '../common/enums/department.enum';
import { LocationType } from '../common/enums/location-type.enum';

/**
 * Representative fixture matching the patterns described in the brief:
 *   - Buildings A, B (roots)
 *   - Floors A-01, B-05 (intermediate)
 *   - Rooms with department, capacity, open time (bookable)
 *   - Sub-nodes (Lobby, Corridor, Pantry) — not bookable
 *   - Noise: duplicate names, "Meeting Toilet" → filtered out by the seed runner
 *
 * The actual sample dataset from the brief is not bundled with the design
 * document; this fixture mirrors its shape so the seed can be replaced
 * verbatim once the real data is available.
 */
export interface SeedRow {
  name: string;
  locationNumber: string;
  building: string;
  type: LocationType;
  parentNumber: string | null;
  department?: Department;
  capacity?: number;
  openTime?: { dayRange: string; timeRange?: string };
}

export const SEED_ROWS: SeedRow[] = [
  // Buildings
  { name: 'Building A', locationNumber: 'A',    building: 'A', type: LocationType.BUILDING, parentNumber: null },
  { name: 'Building B', locationNumber: 'B',    building: 'B', type: LocationType.BUILDING, parentNumber: null },

  // Floors
  { name: 'Floor 01',   locationNumber: 'A-01', building: 'A', type: LocationType.FLOOR, parentNumber: 'A' },
  { name: 'Floor 05',   locationNumber: 'B-05', building: 'B', type: LocationType.FLOOR, parentNumber: 'B' },

  // Sub-nodes (non-bookable)
  { name: 'Lobby',      locationNumber: 'A-01-L',  building: 'A', type: LocationType.OTHER, parentNumber: 'A-01' },
  { name: 'Corridor',   locationNumber: 'A-01-C',  building: 'A', type: LocationType.OTHER, parentNumber: 'A-01' },
  { name: 'Pantry',     locationNumber: 'B-05-P',  building: 'B', type: LocationType.OTHER, parentNumber: 'B-05' },

  // Rooms (bookable)
  {
    name: 'Meeting Room 1',
    locationNumber: 'A-01-01', building: 'A', type: LocationType.ROOM, parentNumber: 'A-01',
    department: Department.EFM, capacity: 8,
    openTime: { dayRange: 'Mon to Fri', timeRange: '09:00-18:00' },
  },
  {
    name: 'Meeting Room 2',
    locationNumber: 'A-01-02', building: 'A', type: LocationType.ROOM, parentNumber: 'A-01',
    department: Department.FSS, capacity: 12,
    openTime: { dayRange: 'Mon to Fri', timeRange: '09:00-18:00' },
  },
  {
    name: 'Meeting Room 2',
    locationNumber: 'A-01-03', building: 'A', type: LocationType.ROOM, parentNumber: 'A-01',
    department: Department.AVS, capacity: 12,
    openTime: { dayRange: 'Mon to Sat', timeRange: '09:00-18:00' },
  },
  {
    name: 'War Room',
    locationNumber: 'B-05-11', building: 'B', type: LocationType.ROOM, parentNumber: 'B-05',
    department: Department.AVS, capacity: 20,
    openTime: { dayRange: 'Mon to Sun', timeRange: '08:00-22:00' },
  },
  {
    name: 'Quiet Pod',
    locationNumber: 'B-05-12', building: 'B', type: LocationType.ROOM, parentNumber: 'B-05',
    department: Department.ASS, capacity: 4,
    openTime: { dayRange: 'Always open' },
  },

  // Noise — must be filtered by the seed runner
  { name: 'Meeting Toilet', locationNumber: 'A-01-99', building: 'A', type: LocationType.ROOM, parentNumber: 'A-01' },
  { name: 'Meeting Room 1', locationNumber: 'A-01-01', building: 'A', type: LocationType.ROOM, parentNumber: 'A-01' }, // duplicate
];

/** Names that should never enter the database (noise from the brief). */
export const NOISE_NAMES = new Set(['Meeting Toilet']);
