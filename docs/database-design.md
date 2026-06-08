# Database Design — SJ Assignment 2026

Four tables on PostgreSQL 16. UUIDs everywhere, timestamps managed by TypeORM, no soft deletes.

```
+---------------------+                +-----------------+
|       users         |                |    open_times   |
|---------------------|                |-----------------|
| id            PK    |                | id          PK  |
| email         UQ    |                | startDay  INT?  |
| passwordHash        |                | endDay    INT?  |
| createdAt           |                | startTime TIME? |
| updatedAt           |                | endTime   TIME? |
+---------------------+                | isAlwaysOpen    |
                                       +-----------------+
                                              ▲ 1:1 (nullable)
                                              │  openTimeId
+---------------------+   parentId             │
|     locations       |◄──────────────┐        │
|---------------------|               │        │
| id            PK    |───────────────┘        │
| name                |                        │
| locationNumber UQ   |                        │
| building            |                        │
| type        ENUM    |                        │
| parentId      FK?   |                        │
| department  ENUM?   |                        │
| capacity      INT?  |                        │
| openTimeId    FK?───────────────────────────┘
| createdAt/updatedAt |
+---------------------+
        ▲ locationId FK (CASCADE on delete)
        │
+---------------------+
|      bookings       |
|---------------------|
| id            PK    |
| locationId    FK    |
| department  ENUM    |
| attendees     INT   |
| bookingDate  DATE   |
| startTime    TIME   |
| endTime      TIME   |
| status      ENUM    |
| createdAt           |
+---------------------+
```

---

## Enumerations

| Enum            | Values                                  | Used by                          |
|-----------------|-----------------------------------------|----------------------------------|
| `Department`    | `EFM`, `FSS`, `AVS`, `ASS`              | `locations.department`, `bookings.department` |
| `LocationType`  | `BUILDING`, `FLOOR`, `ROOM`, `OTHER`    | `locations.type`                 |
| `BookingStatus` | `CONFIRMED`, `REJECTED`                 | `bookings.status`                |

---

## Table: `locations`

Self-referencing adjacency list. Each row is a node in the building/floor/room tree.

| Column           | Type             | Null | Default | Description                                                      |
|------------------|------------------|:----:|---------|------------------------------------------------------------------|
| `id`             | UUID             |  No  | gen     | Primary key                                                      |
| `name`           | VARCHAR          |  No  |         | Display name ("Meeting Room 1")                                  |
| `locationNumber` | VARCHAR          |  No  |         | Hierarchical id; **unique** (`A-01-01`)                          |
| `building`       | VARCHAR          |  No  |         | Building code (`A`, `B`)                                         |
| `type`           | ENUM `LocationType` | No |         | Tree level / role                                                |
| `parentId`       | UUID             | Yes  | NULL    | FK → `locations.id`; `ON DELETE CASCADE`                         |
| `department`     | ENUM `Department`| Yes  | NULL    | Required only for `ROOM` rows that should be bookable            |
| `capacity`       | INT              | Yes  | NULL    | Required only for `ROOM` rows                                    |
| `openTimeId`     | UUID             | Yes  | NULL    | FK → `open_times.id`; 1:1                                        |
| `createdAt`      | TIMESTAMP        |  No  | now()   | Managed by TypeORM (`@CreateDateColumn`)                         |
| `updatedAt`      | TIMESTAMP        |  No  | now()   | Managed by TypeORM (`@UpdateDateColumn`)                         |

**Indexes**

- PK on `id`
- UNIQUE on `locationNumber`

**Service-enforced invariants** (not DB constraints, but documented here):

- `BUILDING` rows must have `parentId IS NULL`.
- Non-`BUILDING` rows must have `parentId IS NOT NULL`.
- A row with `type = ROOM` cannot be a parent (i.e. no children may point to it).
- Deleting a row with children is rejected unless the request supplies `?cascade=true`. Cascade then relies on the DB-level `ON DELETE CASCADE`.

---

## Table: `open_times`

A normalised representation of the brief's open-time strings. One row per location at most (1:1 via `locations.openTimeId`).

| Column         | Type    | Null | Default | Description                                |
|----------------|---------|:----:|---------|--------------------------------------------|
| `id`           | UUID    |  No  | gen     | Primary key                                |
| `startDay`     | INT     | Yes  | NULL    | 0=Sun … 6=Sat; null when `isAlwaysOpen`    |
| `endDay`       | INT     | Yes  | NULL    | Same encoding                              |
| `startTime`    | TIME    | Yes  | NULL    | `HH:MM:SS`; null when `isAlwaysOpen`       |
| `endTime`      | TIME    | Yes  | NULL    | `HH:MM:SS`                                 |
| `isAlwaysOpen` | BOOLEAN |  No  | false   | When true, the four fields above are null  |

`startDay > endDay` is **valid** and means the open range wraps the week (e.g. `Sat → Mon`); the `TimeValidator` honours that explicitly.

The free-text source strings (`"Mon to Fri"`, `"09:00-18:00"`, `"Always open"`, `"24/7"`) are normalised by `src/locations/open-time.parser.ts` during seeding and `POST /locations`.

---

## Table: `bookings`

One row per booking attempt — even rejected ones are persisted so they appear in the audit trail.

| Column        | Type             | Null | Default | Description                                  |
|---------------|------------------|:----:|---------|----------------------------------------------|
| `id`          | UUID             |  No  | gen     | Primary key                                  |
| `locationId`  | UUID             |  No  |         | FK → `locations.id`; `ON DELETE CASCADE`     |
| `department`  | ENUM `Department`|  No  |         | Requester's department                       |
| `attendees`   | INT              |  No  |         | Number of attendees (> 0)                    |
| `bookingDate` | DATE             |  No  |         | `YYYY-MM-DD`                                 |
| `startTime`   | TIME             |  No  |         | `HH:MM:SS`                                   |
| `endTime`     | TIME             |  No  |         | `HH:MM:SS`; service enforces `start < end`   |
| `status`      | ENUM `BookingStatus` | No |         | Set by `BookingsService` after running rules |
| `createdAt`   | TIMESTAMP        |  No  | now()   | Managed by TypeORM                           |

**Indexes**

- PK on `id`
- (implicit) FK index on `locationId` from PostgreSQL

The three validation rules that decide `status` are documented in [`system-design.md`](./system-design.md#strategy--booking-validation).

---

## Table: `users`

Authentication subjects. One row per registered account.

| Column         | Type      | Null | Default | Description                          |
|----------------|-----------|:----:|---------|--------------------------------------|
| `id`           | UUID      |  No  | gen     | Primary key                          |
| `email`        | VARCHAR   |  No  |         | Lower-cased on write; **unique**     |
| `passwordHash` | VARCHAR   |  No  |         | bcrypt cost-10 hash                  |
| `createdAt`    | TIMESTAMP |  No  | now()   |                                      |
| `updatedAt`    | TIMESTAMP |  No  | now()   |                                      |

**Indexes**

- PK on `id`
- UNIQUE on `email`

The plaintext password is never stored. `AuthService` lowercases the inbound email so unique-violation behaviour is case-insensitive.

---

## Relationships at a glance

| Parent → Child                              | Cardinality | On delete |
|---------------------------------------------|-------------|-----------|
| `locations.parentId` → `locations.id`       | many → one (self) | CASCADE |
| `locations.openTimeId` → `open_times.id`    | one → one (nullable) | open_time orphan is cleaned by service |
| `bookings.locationId` → `locations.id`      | many → one  | CASCADE |

There are **no foreign keys from `bookings` to `users`** in this iteration — the assignment didn't require booking attribution. Adding a `bookings.createdById → users.id` column is a one-migration change if that becomes a requirement.

---

## Lifecycle and data integrity

- **Schema management.** Development runs with `DB_SYNCHRONIZE=true` (TypeORM creates and alters tables to match entities). Production should ship versioned migrations via `npm run migration:generate` / `migration:run` and set `DB_SYNCHRONIZE=false`.
- **Cascading deletes.** Removing a `BUILDING` with `?cascade=true` walks the tree via `ON DELETE CASCADE`, which also reaps every `bookings` row pointing at the deleted rooms. The `open_times` rows are orphaned and cleaned up explicitly by `LocationsService.update` when an open-time is removed; a follow-up migration could add a trigger or a periodic cleanup.
- **Seeding.** `npm run db:seed` is idempotent — it filters noise (`Meeting Toilet`, duplicate numbers), topo-sorts so parents are inserted first, and parses the brief's open-time strings into structured rows.
- **Time fields.** PostgreSQL `TIME` is stored without timezone; the application treats all dates and times as the room's local time. `bookingDate` is parsed in UTC for the day-of-week check (`new Date('2026-06-10T00:00:00Z').getUTCDay()`), so the day-of-week test is stable regardless of server timezone.

---

## Future-facing notes (not implemented)

These are not in scope today but the schema accommodates them cleanly:

- **Closure table.** Swap the adjacency-list for TypeORM's `@Tree('closure-table')` if subtree queries become hot. The current `parentId` column maps directly.
- **Overlap detection.** A `bookings (locationId, bookingDate)` composite index plus a `tsrange` exclusion constraint would let Postgres reject overlapping CONFIRMED bookings at the DB level.
- **User attribution.** Add `bookings.createdById UUID FK → users.id` and read it from `req.user.userId` in `BookingsService.create`.
