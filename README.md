# City Mall Smart Locker MVP

Premium software MVP for a scalable smart locker ecosystem prepared for kiosk, admin dashboard, PostgreSQL, Prisma, and future ESP32 hardware integration.

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS, App Router
- Backend: NestJS, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Package manager: npm

## Project Structure

```txt
smart-locker-system/
  frontend/   Next.js presentation dashboard
  backend/    NestJS API foundation
  database/   Prisma schema and database assets
  docs/       Architecture and implementation notes
```

## Features

- Premium dark smart locker dashboard
- 60 persistent demo lockers seeded on first backend launch
- Summary metrics for total, active, available, expired, maintenance, and occupancy percentage
- NestJS API routes:
  - `GET /api/lockers`
  - `GET /api/lockers/:id`
  - `GET /api/locker/status`
  - `POST /api/locker/open`
  - `POST /api/locker/close`
  - `POST /api/booking/create`
  - `POST /api/payment/mock`
  - `POST /api/access/verify`
  - `GET /api/admin/statistics`
- Prisma schema and migration for `locker_system`
- Booking, payment, tariff, access code, log, user, admin, and session models
- Socket.io realtime updates for locker and booking changes
- Hardware-ready simulated adapter for future ESP32 relay commands

## Setup

Create environment files:

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Install and run frontend:

```bash
cd frontend
npm install
npm run dev
```

Install and run backend:

```bash
cd backend
npm install
npm run start:dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/lockers`

## Database

Create PostgreSQL database:

```sql
CREATE DATABASE locker_system;
```

Generate Prisma client from the shared database schema:

```bash
cd backend
npx prisma generate
```

Run migrations when PostgreSQL is available:

```bash
cd backend
npx prisma migrate dev --name init
```

For local prototypes where you want to sync schema without creating another migration:

```bash
cd backend
npm run db:push
```

When the backend starts against an empty database, it automatically seeds 60 demo lockers.

## Self-Healing Diagnostics

Run a full local health check:

```bash
npm run doctor
```

The doctor checks:

- `backend/.env` and `DATABASE_URL`
- PostgreSQL connectivity
- Prisma client generation
- Prisma migration status
- 60-locker seed health
- Backend API health
- Frontend server health
- stale `.next` cache symptoms

Run full project verification:

```bash
npm run verify
```

This runs backend lint/build/e2e tests and frontend lint/build.

If Next.js shows a missing compiled chunk such as `Cannot find module './611.js'`, reset the frontend cache:

```bash
npm run fix:frontend-cache
npm run dev:frontend
```

## Current Project State

The latest handover notes are stored in:

```txt
docs/project-state.md
```

Use this file if the project is reopened later and you need to remember the current database, commands, resolved issues, architecture decisions, and next recommended tasks.

Security hardening notes are stored in:

```txt
docs/security-readiness.md
```

TЗ coverage and operator handover notes:

```txt
docs/tz-gap-analysis.md
docs/operator-guide.md
```

## Hardware Readiness

The backend already separates locker business actions from hardware commands through a simulated hardware service. Future ESP32 integration should replace or extend `SimulatedHardwareService` with an adapter that sends HTTP, MQTT, or WebSocket commands to physical locker controllers.
