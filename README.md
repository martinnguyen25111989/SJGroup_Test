# SJ Assignment for Nguyen Anh Tuan 2026 — Location Management & Booking Management API

RESTful backend for managing a hierarchical building/floor/room tree and room bookings, built with **NestJS · TypeScript · TypeORM · PostgreSQL**.

Design docs:

- [`docs/system-design.md`](./docs/system-design.md) — architecture, modules, design patterns, cross-cutting concerns, auth flow.
- [`docs/database-design.md`](./docs/database-design.md) — table-by-table schema, ER diagram, lifecycle notes.
- [`document overview`](./SJ_Assignment_2026_Design_Document_EN.docx) — original assignment brief.

---

## Tech stack

| Layer    | Tool                                  |
|----------|---------------------------------------|
| Runtime  | Node.js 20                            |
| Framework| NestJS 10                             |
| Language | TypeScript 5                          |
| ORM      | TypeORM 0.3 (adjacency-list tree)     |
| Database | PostgreSQL 16                         |
| Docs     | Swagger / OpenAPI at `/docs`          |
| Tests    | Jest                                  |

---

## Prerequisites

- Node.js 20+
- npm 10+
- A reachable PostgreSQL instance (Docker recommended; see below)

---

## Quick start

```bash
# 1. Install deps (includes @nestjs/typeorm, typeorm, pg)
npm install

# 2. Start Postgres (Docker, on port 5434 to avoid conflicts)
docker run -d --name sj-postgres \
  -e POSTGRES_USER=postgre_sj \
  -e POSTGRES_PASSWORD=postgre_sj_123 \
  -e POSTGRES_DB=sj_assignment \
  -p 5434:5432 \
  postgres:16

# 3. Copy env template and adjust if needed
cp .env.example .env

# 4. Seed sample data
npm run db:seed

# 5. Start the API
npm run start:dev
```

API listens on `http://localhost:3000`. Swagger UI at `http://localhost:3000/docs`.

---

## Environment

Configured via `.env` (see `.env.example`).

| Variable        | Default         | Description                        |
|-----------------|-----------------|------------------------------------|
| `PORT`          | `3000`          | HTTP port                          |
| `DB_HOST`       | `localhost`     |                                    |
| `DB_PORT`       | `5432`          | (use `5434` for the Docker setup)  |
| `DB_USERNAME`   | `postgres`      |                                    |
| `DB_PASSWORD`   | `postgres`      |                                    |
| `DB_NAME`       | `sj_assignment` |                                    |
| `DB_SYNCHRONIZE`| `true`          | Auto-create schema (dev only)      |
| `DB_LOGGING`    | `false`         | Log SQL                            |
| `LOG_LEVEL`     | `error,warn,log`| CSV of Nest log levels             |
| `SLOW_REQUEST_MS`| `1000`         | Slow-request threshold (ms)        |
| `JWT_SECRET`    | _(required)_    | HMAC secret used to sign JWTs      |
| `JWT_EXPIRES_IN`| `1h`            | Token lifetime (jsonwebtoken format) |

---

## Project structure

```
src/
├── common/
│   ├── enums/                  # Department, LocationType, BookingStatus
│   ├── exceptions/             # Domain exceptions (NotFound, Conflict, Rejected, …)
│   ├── filters/                # HttpExceptionFilter (uniform error envelope)
│   ├── interceptors/           # LoggingInterceptor (paired →/← lines, slow-tag)
│   └── middleware/             # RequestIdMiddleware (X-Request-Id)
├── config/
│   └── typeorm.config.ts       # Async TypeORM factory
├── locations/
│   ├── dto/                    # Create/Update/OpenTime DTOs
│   ├── location.entity.ts      # Self-referencing tree
│   ├── open-time.entity.ts
│   ├── open-time.parser.ts     # "Mon to Fri 09:00-18:00" → structured
│   ├── open-time.parser.spec.ts
│   ├── locations.controller.ts
│   ├── locations.service.ts
│   ├── locations.service.spec.ts
│   └── locations.module.ts
├── bookings/
│   ├── dto/                    # CreateBookingDto, QueryBookingsDto
│   ├── validators/             # Strategy: Department, Capacity, Time + interface
│   ├── booking.entity.ts
│   ├── bookings.controller.ts
│   ├── bookings.service.ts
│   ├── bookings.service.spec.ts
│   └── bookings.module.ts
├── seed/
│   ├── seed-data.ts            # Fixture rows
│   └── seed.ts                 # Standalone seed runner
├── data-source.ts              # Standalone TypeORM DataSource
├── app.module.ts               # Wires RequestIdMiddleware globally
└── main.ts                     # Bootstraps Swagger, global filter, interceptor
```

---

## API

### Auth

| Method | Endpoint           | Description                                              |
|--------|--------------------|----------------------------------------------------------|
| POST   | `/auth/register`   | Create an account; returns `{ accessToken, user, … }`    |
| POST   | `/auth/login`      | Exchange credentials for a JWT                           |
| GET    | `/auth/me`         | Echo the authenticated user from the JWT (bearer-only)   |

```bash
# Register and grab the token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"a-strong-password"}' | jq -r .accessToken)

# Use it on a protected route
curl -s -X POST http://localhost:3000/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Tower A","locationNumber":"A","building":"A","type":"BUILDING"}'
```

In Swagger UI, click **Authorize** and paste the `accessToken` value (no `Bearer ` prefix).

### Locations

| Method | Endpoint              | Auth | Description                                |
|--------|-----------------------|------|--------------------------------------------|
| POST   | `/locations`          | JWT  | Create a node (validates parent)           |
| GET    | `/locations/tree`     | —    | Full hierarchy as a nested tree            |
| GET    | `/locations/:id`      | —    | Single location                            |
| PATCH  | `/locations/:id`      | JWT  | Update name/department/capacity/openTime   |
| DELETE | `/locations/:id?cascade=true` | JWT | Delete (blocked if children unless cascade) |

### Bookings

| Method | Endpoint           | Auth | Description                                                |
|--------|--------------------|------|------------------------------------------------------------|
| POST   | `/bookings`        | JWT  | Create; returns `{ booking, failures[] }`. `booking.status` is `CONFIRMED` only if all 3 rules pass. |
| GET    | `/bookings`        | —    | List; filter by `locationId`, `bookingDate`, `status`     |
| GET    | `/bookings/:id`    | —    | Single booking                                             |

Sample request:

```json
POST /bookings
{
  "locationId": "uuid-of-a-ROOM",
  "department": "EFM",
  "attendees": 6,
  "bookingDate": "2026-06-10",
  "startTime": "09:00",
  "endTime": "10:30"
}
```

Rejected response payload includes per-rule failures:

```json
{
  "booking": { "id": "...", "status": "REJECTED", "...": "..." },
  "failures": [
    { "rule": "CapacityCheck",  "reason": "Attendees 12 exceed room capacity 8" },
    { "rule": "TimeValidation", "reason": "Sat is outside the room's open days (Mon-Fri)" }
  ]
}
```

---

## Validation rules

A booking is `CONFIRMED` only if all three pass; otherwise `REJECTED` with `failures[]`:

| # | Rule (Strategy class)   | Source                                            | Passes when                                                                              |
|---|-------------------------|---------------------------------------------------|------------------------------------------------------------------------------------------|
| 1 | `DepartmentValidator`   | `src/bookings/validators/department.validator.ts` | `booking.department === room.department`                                                 |
| 2 | `CapacityValidator`     | `src/bookings/validators/capacity.validator.ts`   | `booking.attendees <= room.capacity` (and capacity is set)                               |
| 3 | `TimeValidator`         | `src/bookings/validators/time.validator.ts`       | start < end, day in `openTime` range (handles wraparound), times within open hours       |

---

## Database schema

Four tables (see [`docs/database-design.md`](./docs/database-design.md) for column-level detail):

- `locations` — self-referencing adjacency list (`parentId` → `locations.id`)
- `open_times` — day range + time range, or `isAlwaysOpen`
- `bookings` — FK to `locations.id`, enum `status`
- `users` — JWT auth subjects (unique email + bcrypt hash)

```
+---------------------+              +-----------------+
|     locations       |  parentId    |    open_times   |
|---------------------|◄─────┐       |-----------------|
| id (PK)             |      │       | id (PK)         |
| name                |      │       | startDay 0-6    |
| locationNumber UQ   |      │       | endDay   0-6    |
| building            |      │       | startTime       |
| type                |──────┘       | endTime         |
| parentId   FK self  |              | isAlwaysOpen    |
| department  null    |              +-----------------+
| capacity    null    |                     ▲
| openTimeId  FK───────────────────────────┘ 1:1
| createdAt/updatedAt |
+---------------------+
        ▲
        │  locationId FK
+---------------------+
|      bookings       |
|---------------------|
| id (PK)             |
| locationId  FK      |
| department          |
| attendees           |
| bookingDate         |
| startTime/endTime   |
| status              |
| createdAt           |
+---------------------+
```

### Applied design patterns

- **Strategy** — `BookingValidator` interface with three concrete classes (`DepartmentValidator`, `CapacityValidator`, `TimeValidator`) injected as an array via the `BOOKING_VALIDATORS` token. New rules drop in without touching the service.
- **Repository** — TypeORM repositories injected through `@InjectRepository`, keeping data access out of the services.
- **DTO + class-validator** — controllers receive shape-validated DTOs; `whitelist + forbidNonWhitelisted` blocks unknown fields.

### Cross-cutting concerns

- **Global exception filter** (`HttpExceptionFilter`) — uniform `{ statusCode, message, error?, reasons?, path, requestId, timestamp }` shape. 5xx logs include stack traces; 4xx log at `warn`.
- **Logging interceptor** (`LoggingInterceptor`) — paired inbound/outbound lines per request: `→ METHOD URL [reqId]` then `← METHOD URL status duration_ms [reqId]`. Slow responses (≥ `SLOW_REQUEST_MS`) log as `SLOW …` warn.
- **Request-id middleware** (`RequestIdMiddleware`) — echoes the inbound `X-Request-Id` header or generates a UUID, sets the response header, attaches `req.id`. The id is included in HTTP logs and in every error body so a client can grep server logs from a single response.
- **Domain logging** — `BookingsService` logs `CONFIRMED`/`REJECTED` outcomes (with failure reasons); `LocationsService` logs create/remove events.
- **Domain exceptions** in `src/common/exceptions/domain.exceptions.ts` map business errors to HTTP status codes consistently.

### Logging configuration

| Env var           | Default                | Description                                                                |
|-------------------|------------------------|----------------------------------------------------------------------------|
| `LOG_LEVEL`       | `error,warn,log`       | CSV of Nest log levels (`error,warn,log,debug,verbose`)                    |
| `SLOW_REQUEST_MS` | `1000`                 | Requests at or above this duration are tagged `SLOW` and logged at `warn` |

Example wire trace for a rejected booking:

```
[Nest] HTTP    → POST /bookings [3e1f…]
[Nest] BookingsService    Booking 7c2… REJECTED: CapacityCheck(Attendees 12 exceed room capacity 8)
[Nest] HTTP    ← POST /bookings 201 14.3ms [3e1f…]
```

---

## OpenTime parser

`parseOpenTime(dayRange, timeRange)` accepts:

- `"Always open"` / `"24/7"` → `{ isAlwaysOpen: true, … }`
- `"Mon to Fri"` + `"09:00-18:00"` → `{ startDay: 1, endDay: 5, startTime: "09:00", endTime: "18:00" }`
- Single days, em/en dashes, single-digit hours, etc.

Day mapping: `Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6`.

---

## Seeding

`npm run db:seed` filters noise (`Meeting Toilet`, duplicate location numbers), topo-sorts the rows so parents insert first, parses open-time strings, and is **idempotent** — running it twice is safe.

Edit `src/seed/seed-data.ts` to swap in your own dataset.

---

## Scripts

| Command              | Description                              |
|----------------------|------------------------------------------|
| `npm run start:dev`  | Run with watch mode                      |
| `npm run build`      | Compile to `dist/`                       |
| `npm run start:prod` | Run compiled output                      |
| `npm test`           | Jest unit tests                          |
| `npm run db:seed`    | Seed sample data                         |
| `npm run lint`       | ESLint                                   |
