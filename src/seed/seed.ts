import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { AppDataSource } from '../data-source';
import { Location } from '../locations/location.entity';
import { OpenTime } from '../locations/open-time.entity';
import { parseOpenTime } from '../locations/open-time.parser';
import { NOISE_NAMES, SEED_ROWS, SeedRow } from './seed-data';

const logger = new Logger('Seed');

async function run() {
  await AppDataSource.initialize();
  const locations = AppDataSource.getRepository(Location);
  const openTimes = AppDataSource.getRepository(OpenTime);

  const cleaned = dedupe(SEED_ROWS.filter((row) => !NOISE_NAMES.has(row.name)));
  logger.log(`Seeding ${cleaned.length} rows (filtered ${SEED_ROWS.length - cleaned.length} noise rows)`);

  // Insert in two passes: parents first (no parentNumber), then the rest in
  // dependency order so parentId can be resolved.
  const byNumber = new Map<string, Location>();
  const ordered = topoSort(cleaned);

  for (const row of ordered) {
    if (await locations.existsBy({ locationNumber: row.locationNumber })) {
      const existing = await locations.findOneByOrFail({ locationNumber: row.locationNumber });
      byNumber.set(row.locationNumber, existing);
      continue;
    }

    const parent = row.parentNumber ? byNumber.get(row.parentNumber) : null;
    if (row.parentNumber && !parent) {
      logger.warn(`Skipping ${row.locationNumber}: parent ${row.parentNumber} missing`);
      continue;
    }

    let openTime: OpenTime | null = null;
    if (row.openTime) {
      const parsed = parseOpenTime(row.openTime.dayRange, row.openTime.timeRange);
      openTime = await openTimes.save(openTimes.create(parsed));
    }

    const created = await locations.save(
      locations.create({
        name: row.name,
        locationNumber: row.locationNumber,
        building: row.building,
        type: row.type,
        parentId: parent?.id ?? null,
        department: row.department ?? null,
        capacity: row.capacity ?? null,
        openTime,
      }),
    );
    byNumber.set(created.locationNumber, created);
    logger.log(`+ ${created.locationNumber} ${created.name}`);
  }

  await AppDataSource.destroy();
  logger.log('Seed complete');
}

function dedupe(rows: SeedRow[]): SeedRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.locationNumber)) return false;
    seen.add(row.locationNumber);
    return true;
  });
}

function topoSort(rows: SeedRow[]): SeedRow[] {
  const byNumber = new Map(rows.map((r) => [r.locationNumber, r]));
  const visited = new Set<string>();
  const out: SeedRow[] = [];
  const visit = (row: SeedRow) => {
    if (visited.has(row.locationNumber)) return;
    visited.add(row.locationNumber);
    if (row.parentNumber && byNumber.has(row.parentNumber)) {
      visit(byNumber.get(row.parentNumber)!);
    }
    out.push(row);
  };
  rows.forEach(visit);
  return out;
}

run().catch((err) => {
  logger.error(err);
  process.exit(1);
});
