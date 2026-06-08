# System Design — SJ Assignment 2026

RESTful backend for managing a hierarchical building/floor/room tree, room bookings with three validation rules, and JWT-based authentication.

- **Framework:** NestJS 10 (TypeScript 5)
- **ORM:** TypeORM 0.3 (adjacency-list tree)
- **Database:** PostgreSQL 16
- **Auth:** `@nestjs/jwt` + `passport-jwt` + bcrypt
- **Docs:** Swagger / OpenAPI at `/docs`

This document describes the runtime architecture and the design decisions behind it. For column-level schema detail see [`database-design.md`](./database-design.md).

---

## 1. High-level architecture

```
HTTP client
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│  Express adapter (Nest)                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ RequestIdMiddleware  → attaches req.id, X-Request-Id    │ │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ValidationPipe  (whitelist + transform + forbid extras) │ │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ LoggingInterceptor  → → METHOD URL [reqId]              │ │
│  │                       ← METHOD URL status duration ms   │ │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ JwtAuthGuard  (on write routes)                         │ │
│  │   passport-jwt → req.user = { userId, email }           │ │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Controllers → Services → Repositories                   │ │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ HttpExceptionFilter  → uniform error envelope          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
   │
   ▼
PostgreSQL (locations, open_times, bookings, users)
```

---

## 2. Modules

| Module             | Responsibilities                                                                 |
|--------------------|----------------------------------------------------------------------------------|
| `AuthModule`       | User registration, login, JWT issuance, passport-jwt strategy, `JwtAuthGuard`    |
| `LocationsModule`  | Tree CRUD, parent validation, cascade delete, open-time parsing                  |
| `BookingsModule`   | Booking creation + three Strategy-pattern validation rules, list/get             |
| `ConfigModule`     | Loads `.env`, exposes `ConfigService` for TypeORM factory                        |
| `TypeOrmModule`    | Postgres connection (`typeorm.config.ts`), `autoLoadEntities: true`              |

Cross-cutting helpers live in `src/common/`: filters, interceptors, middleware, enums, exceptions.

---

## 3. Request lifecycle

For an authenticated booking-creation request:

```
1. RequestIdMiddleware       → mints/echoes X-Request-Id, sets req.id
2. LoggingInterceptor (in)   → logs "→ POST /bookings [reqId]"
3. JwtAuthGuard              → verifies bearer JWT, populates req.user
4. ValidationPipe            → CreateBookingDto class-validator pass
5. BookingsController.create → calls BookingsService.create(dto)
6. BookingsService           → loads Room, runs three validators (Strategy)
7. Repository                → persists Booking with CONFIRMED|REJECTED
8. LoggingInterceptor (out)  → logs "← POST /bookings 201 14ms [reqId]"
   or HttpExceptionFilter    → returns uniform error envelope (logs at warn/error)
```

`req.id` is echoed in every log line and embedded in the error body, so a single client response is enough to grep server logs end-to-end.

---

## 4. Applied design patterns

### Strategy — Booking validation

Booking creation must pass three independent rules. Each rule is a class implementing `BookingValidator`:

```ts
interface BookingValidator {
  readonly name: string;
  validate(booking: CreateBookingDto, room: Location): ValidationResult;
}
```

| Class                 | Rule                                                                                              |
|-----------------------|---------------------------------------------------------------------------------------------------|
| `DepartmentValidator` | `booking.department === room.department`                                                          |
| `CapacityValidator`   | `room.capacity != null && booking.attendees <= room.capacity`                                     |
| `TimeValidator`       | `start < end`, day in `openTime` range (wraparound aware), hours within open hours, or always-open |

`BookingsModule` binds all three concrete classes into an array provided under the `BOOKING_VALIDATORS` injection token. `BookingsService.create` iterates the array, collects every failure, and persists the booking with `CONFIRMED` (no failures) or `REJECTED` (with the `failures[]` array surfaced back to the caller). Adding a fourth rule is a one-file change: drop a new validator into `src/bookings/validators/` and append it to the factory `inject`/`useFactory` list — no other code moves.

### Repository (TypeORM)

Services receive the underlying repository through `@InjectRepository(Entity)`. This keeps queries pluggable (`find`, `findOne`, `existsBy`, `count`, `remove`) and isolates the persistence boundary from business logic. Trees are stored as an adjacency list (`parentId` self-FK) and assembled in-memory by `LocationsService.findTree`.

### DTO + class-validator

Every controller method accepts a DTO with `class-validator` decorators. The global `ValidationPipe` is configured `{ whitelist: true, transform: true, forbidNonWhitelisted: true }`, so unknown fields are rejected outright and primitives are coerced (booleans, numbers, dates).

### JWT bearer authentication

`AuthService.register` and `.login` issue tokens via `JwtService.sign({ sub: userId, email })`. `JwtStrategy` (passport-jwt) extracts `Authorization: Bearer …`, verifies the signature with `JWT_SECRET`, checks expiry, and populates `req.user = { userId, email }`. The `JwtAuthGuard` wraps `AuthGuard('jwt')` and is applied per-route on writes:

| Endpoint                                                | Public | JWT required |
|---------------------------------------------------------|:------:|:------------:|
| `POST /auth/register`, `POST /auth/login`               |   ✓    |              |
| `GET /auth/me`                                          |        |      ✓       |
| `GET /locations/...`, `GET /bookings/...`               |   ✓    |              |
| `POST /locations`, `PATCH /locations/:id`, `DELETE …`   |        |      ✓       |
| `POST /bookings`                                        |        |      ✓       |

Passwords are stored as bcrypt hashes (cost 10). Login returns a uniform `Invalid email or password` for unknown emails and wrong passwords to avoid leaking account existence.

---

## 5. Cross-cutting concerns

### Exception filter (`HttpExceptionFilter`)

A single `@Catch()` filter converts any thrown error into:

```json
{
  "statusCode": 422,
  "message": "BUILDING nodes cannot have a parent",
  "reasons": ["..."],
  "path": "/locations",
  "requestId": "3e1f…",
  "timestamp": "2026-06-08T10:42:01.123Z"
}
```

- `HttpException` instances are unwrapped; non-HTTP errors are coerced to 500 and logged with a stack trace.
- 5xx logs at `error`, 4xx at `warn`. Each log line is tagged `[requestId]`.

Domain exceptions live in `src/common/exceptions/` and map business errors to HTTP codes:

| Exception                          | HTTP | Raised from                                |
|------------------------------------|:----:|--------------------------------------------|
| `LocationNotFoundException`        | 404  | locations service                          |
| `BookingNotFoundException`         | 404  | bookings service                           |
| `InvalidParentException`           | 422  | locations service (tree shape rules)       |
| `LocationNotBookableException`     | 422  | bookings service (non-ROOM target)         |
| `DuplicateLocationNumberException` | 409  | locations service                          |
| `LocationHasChildrenException`     | 409  | locations service (no-cascade delete)      |
| `BookingRejectedException`         | 400  | reserved for future hard-reject flow       |
| `EmailAlreadyRegisteredException`  | 409  | auth service                               |
| `InvalidCredentialsException`      | 401  | auth service                               |

### Logging interceptor (`LoggingInterceptor`)

Emits paired inbound/outbound lines around every HTTP handler:

```
→ POST /bookings [3e1f…]
← POST /bookings 201 14.3ms [3e1f…]
```

Responses at or above `SLOW_REQUEST_MS` are tagged `SLOW` and promoted to `warn`. Errored handlers also emit a `←` line so every `→` has a closing trace; the exception filter logs the actual cause.

### Request-id middleware (`RequestIdMiddleware`)

Echoes a client-supplied `X-Request-Id` header or mints a UUID. Sets it on `req.id`, returns it on the response header, and the exception filter includes it in the JSON body. This is the correlation thread between client logs, server logs, and Postgres slow-query logs.

### Domain logging

Services emit structured `Logger` lines for important events:

- `LocationsService` — `Created BUILDING A (uuid)`, `Removed ROOM A-01-01 (uuid) [cascade]`
- `BookingsService` — `Booking <id> CONFIRMED for room=… dept=… attendees=…`, `Booking <id> REJECTED: CapacityCheck(…); TimeValidation(…)`
- `AuthService` — `Registered user <id> (<email>)`, `User <id> logged in`

These ride on top of Nest's built-in logger; the global log levels are CSV-configurable via `LOG_LEVEL`.

---

## 6. Folder layout

```
src/
├── auth/
│   ├── dto/                    # RegisterDto, LoginDto
│   ├── guards/                 # JwtAuthGuard
│   ├── strategies/             # JwtStrategy (passport-jwt)
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts
│   ├── auth.module.ts
│   ├── current-user.decorator.ts
│   └── user.entity.ts
├── bookings/
│   ├── dto/                    # CreateBookingDto, QueryBookingsDto
│   ├── validators/             # Strategy classes + interface
│   ├── booking.entity.ts
│   ├── bookings.controller.ts
│   ├── bookings.service.ts
│   └── bookings.module.ts
├── locations/
│   ├── dto/
│   ├── location.entity.ts
│   ├── open-time.entity.ts
│   ├── open-time.parser.ts     # "Mon to Fri 09:00-18:00" → structured
│   ├── locations.controller.ts
│   ├── locations.service.ts
│   └── locations.module.ts
├── common/
│   ├── enums/                  # Department, LocationType, BookingStatus
│   ├── exceptions/             # Domain + auth exceptions
│   ├── filters/                # HttpExceptionFilter
│   ├── interceptors/           # LoggingInterceptor
│   └── middleware/             # RequestIdMiddleware
├── config/typeorm.config.ts    # Async TypeORM factory
├── seed/                       # Standalone seed runner + fixtures
├── data-source.ts              # Standalone TypeORM DataSource (migrations, seed)
├── app.module.ts               # Wires modules + middleware
└── main.ts                     # Bootstraps Swagger, global filter/interceptor/pipe
```

---

## 7. Configuration

All knobs are environment-driven. Defaults are dev-friendly; production must override `JWT_SECRET` and `DB_SYNCHRONIZE`.

| Env var           | Default                | Purpose                                                                |
|-------------------|------------------------|------------------------------------------------------------------------|
| `PORT`            | `3000`                 | HTTP port                                                              |
| `DB_*`            | local Postgres         | Connection (host, port, username, password, database)                  |
| `DB_SYNCHRONIZE`  | `true`                 | TypeORM auto-create schema; **disable in production**, use migrations  |
| `DB_LOGGING`      | `false`                | Log generated SQL                                                      |
| `LOG_LEVEL`       | `error,warn,log`       | CSV of Nest log levels                                                 |
| `SLOW_REQUEST_MS` | `1000`                 | Threshold for `SLOW` warn tag on the LoggingInterceptor                |
| `JWT_SECRET`      | _(required)_           | HMAC secret used to sign and verify JWTs                               |
| `JWT_EXPIRES_IN`  | `1h`                   | Access-token lifetime (`jsonwebtoken` format)                          |

---

## 8. Testing

- **Unit tests** for every service and the three booking validators (Jest, mocked repositories).
- 38 tests across 5 suites at the time of writing; the full suite runs in CI via `npm test`.
- The validators have property-style coverage for the day-wraparound case (`Sat → Mon`), always-open rooms, and time edges (`start >= end`).
- `AuthService` tests use a real bcrypt round but with a low cost (4) for speed.
