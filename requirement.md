# SJ ASSIGNMENT 2026 — System Design Document

**Location Management & Booking Management RESTful API**

- **Tech stack:** NestJS · TypeScript · TypeORM · PostgreSQL
- **Stakeholder:** luc.le@coe.surbana.tech
- **Duration:** within 1 week

---

## 1. Project Overview

The goal of this project is to develop a RESTful API backend that manages a hierarchical tree of building locations (Building > Floor > Room) and a room booking system. The system handles complex location relationships and enforces booking rules based on department, capacity, and operational hours.

### 1.1 Scope

- **Primary objective:** a RESTful API for Location Management and Booking Management.
- **Deliverable:** source code pushed to a personal GitHub account.
- **Two business modules:** location management (tree CRUD) and booking management (three validation rules).

### 1.2 Non-functional requirements

- Centralized exception handling via an exception filter.
- Logging for requests, responses, and errors.
- Clean code and documentation (system design and database design).

---

## 2. Technical Stack

| Component | Choice |
|-----------|--------|
| Framework | NestJS (Node.js) — modular architecture, dependency injection |
| Language  | TypeScript — type-safe and maintainable |
| ORM       | TypeORM — supports tree structures (closure table / materialized path) |
| Database  | PostgreSQL — relational, foreign-key constraints |
| API docs  | Swagger / OpenAPI |
| Logging   | Nest Logger + interceptor |

---

## 3. Source Data Analysis

The sample data reveals a three-level hierarchy. Only nodes that have a department, capacity, and open time are bookable rooms; nodes such as Lobby, Corridor, and Pantry lack these attributes and are therefore not bookable.

| Level    | Example              | Characteristics                          | Bookable |
|----------|----------------------|------------------------------------------|----------|
| Building | A, B                 | Root node                                | No       |
| Floor    | A-01, B-05           | Intermediate node                        | No       |
| Room     | A-01-01, B-05-11     | Has department, capacity, open time      | Yes      |
| Sub-node | Lobby, Corridor, Pantry | Missing booking attributes            | No       |

### 3.1 Key notes

- **Department** is a finite set: `EFM`, `FSS`, `AVS`, `ASS` — model it as an enum.
- **Open Time** has several forms (Mon to Fri, Always open, Mon to Sun...) — model it as a structure (day range + time range) rather than a raw string.
- **Location Number** is hierarchical (`A-01-01` sits under `A-01`), but `parentId` should be stored explicitly for tree queries.
- The sample data contains noise (duplicate names, "Meeting Toilet") — clean it during seeding.

---

## 4. Database Design

The model has three tables. The `locations` table is self-referencing (adjacency list) to represent the tree; it can be upgraded to TypeORM's closure table for more efficient tree queries.

### 4.1 `locations` table

| Column         | Type             | Description                              |
|----------------|------------------|------------------------------------------|
| id             | UUID (PK)        | Primary key                              |
| name           | VARCHAR          | Display name (Meeting Room 1)            |
| locationNumber | VARCHAR (UNIQUE) | Identifier (A-01-01)                     |
| building       | VARCHAR          | Building code (A, B)                     |
| type           | ENUM             | `BUILDING` \| `FLOOR` \| `ROOM` \| `OTHER` |
| parentId       | UUID (FK, null)  | References `locations.id`                |
| department     | ENUM (null)      | `EFM` \| `FSS` \| `AVS` \| `ASS`         |
| capacity       | INT (null)       | Maximum capacity                         |
| openTimeId     | UUID (FK, null)  | References `open_times.id`               |
| createdAt / updatedAt | TIMESTAMP | Creation / update time                |

### 4.2 `open_times` table

| Column       | Type        | Description                |
|--------------|-------------|----------------------------|
| id           | UUID (PK)   | Primary key                |
| startDay     | INT (0-6)   | Start day (Mon=1)          |
| endDay       | INT (0-6)   | End day (Fri=5)            |
| startTime    | TIME        | Opening time (09:00)       |
| endTime      | TIME        | Closing time (18:00)       |
| isAlwaysOpen | BOOLEAN     | Open 24/7                  |

### 4.3 `bookings` table

| Column                | Type        | Description                       |
|-----------------------|-------------|-----------------------------------|
| id                    | UUID (PK)   | Primary key                       |
| locationId            | UUID (FK)   | Booked room                       |
| department            | ENUM        | Requester's department            |
| attendees             | INT         | Number of attendees               |
| bookingDate           | DATE        | Booking date                      |
| startTime / endTime   | TIME        | Booking time range                |
| status                | ENUM        | `CONFIRMED` \| `REJECTED`         |
| createdAt             | TIMESTAMP   | Creation time                     |

---

## 5. System Design

The system follows NestJS's layered architecture: the controller receives requests, the service handles business logic, and the repository (TypeORM) accesses data. The `common` layer holds the shared logging interceptor and exception filter.

### 5.1 Folder structure

```
src/
├── locations/
│   ├── location.entity.ts
│   ├── locations.controller.ts
│   ├── locations.service.ts      // tree logic, validate parent
│   └── dto/
├── bookings/
│   ├── booking.entity.ts
│   ├── bookings.controller.ts
│   ├── bookings.service.ts       // orchestrate validations
│   └── validators/               // Department, Capacity, Time rules
├── common/
│   ├── filters/                  // http-exception.filter.ts
│   ├── interceptors/             // logging.interceptor.ts
│   └── enums/                    // Department, LocationType
└── main.ts
```

### 5.2 Applied design patterns

- **Strategy pattern** for the three booking rules: each rule is an independent class, easy to test and extend.
- **Repository pattern** via TypeORM to isolate data-access logic.
- **DTO + class-validator** to validate input at the controller layer.

---

## 6. API Design

### 6.1 Location Management

| Method | Endpoint           | Description                                       |
|--------|--------------------|---------------------------------------------------|
| POST   | `/locations`       | Create a new node, validate parent exists         |
| GET    | `/locations/tree`  | Retrieve the full location tree                   |
| GET    | `/locations/:id`   | Retrieve details of one location                  |
| PATCH  | `/locations/:id`   | Update capacity, open time, department            |
| DELETE | `/locations/:id`   | Delete a node (block or cascade if it has children) |

### 6.2 Booking Management

| Method | Endpoint          | Description                              |
|--------|-------------------|------------------------------------------|
| POST   | `/bookings`       | Create a booking, run through the three rules |
| GET    | `/bookings`       | List bookings (filter by room/date)      |
| GET    | `/bookings/:id`   | Retrieve details of one booking          |

---

## 7. Booking Validation Rules

Each booking request must pass all three rules; if any rule is violated, the booking is rejected.

| Rule                    | Validation logic                                                                 |
|-------------------------|----------------------------------------------------------------------------------|
| 1. Department Matching  | `booking.department` must equal `room.department`, otherwise REJECT              |
| 2. Capacity Check       | `booking.attendees` must not exceed `room.capacity`                              |
| 3. Time Validation      | Booking date and time range must fall within the room's open time (e.g. a "Mon to Fri" room rejects weekend bookings) |

---

## 8. Exception Handling and Logging

- Global exception filter returns a uniform error shape (`statusCode`, `message`, `timestamp`, `path`).
- Custom exceptions: `LocationNotFoundException`, `BookingRejectedException`, `InvalidParentException`.
- Logging interceptor records the method, URL, and processing time of each request.
- Errors are logged with stack traces at `error` level; normal requests at `log`/`debug` level.

## 09. Delivery Checklist

- [ ] Source code on a personal GitHub account (public).
- [ ] README: run instructions, system design, database diagram.
- [ ] Location CRUD works and returns the tree.
- [ ] Booking validates all three rules.
- [ ] Centralized exception handling and logging.
- [ ] Swagger / OpenAPI documentation.
