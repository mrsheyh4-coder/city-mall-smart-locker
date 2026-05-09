# Smart Locker System - Current Project State

Last verified: 2026-05-09

## Project Path

```txt
F:\city mall praeekt\smart-locker-system
```

## Current Status

The system is healthy and running with persistent PostgreSQL state.

Verified:

- PostgreSQL connection works
- Prisma migration applied
- Prisma client generated
- 60 lockers exist in database
- Backend API works
- Frontend works
- `npm run doctor` reports healthy system
- `npm run verify` passes lint/build/test checks
- Admin routes and direct locker commands now require a backend-issued admin token
- PIN/QR, mock payment, webhook, and login endpoints have practical rate limits
- Payment webhooks require signatures outside `PAYMENT_MODE=MOCK`
- Kiosk booking requires storage terms acceptance before locker selection
- Successful mock payment queues an SMS access-code preview
- 1C tariff JSON import endpoint is available
- CCTV events return 30-day archive metadata

## Running URLs

```txt
Frontend: http://localhost:3000
Backend:  http://localhost:4000
API:      http://localhost:4000/api/lockers
```

Backend API requires:

```txt
X-API-Version: 1
```

The frontend already sends this header automatically.

## Database

Database:

```txt
locker_system
```

PostgreSQL user:

```txt
postgres
```

The actual connection string is stored in:

```txt
backend/.env
```

Do not commit `backend/.env` to GitHub.

Important note: the password contains `@`, so inside `DATABASE_URL` it must be URL-encoded as `%40`.

## Database Tables

Current Prisma models:

- `Locker`
- `Session`
- `AccessLog`

Locker statuses:

```txt
AVAILABLE
OCCUPIED
RESERVED
EXPIRED
MAINTENANCE
```

Locker sizes:

```txt
SMALL
MEDIUM
LARGE
```

Session statuses:

```txt
ACTIVE
EXPIRED
COMPLETED
```

## Important Commands

Run backend:

```bash
npm run dev:backend
```

Run frontend:

```bash
npm run dev:frontend
```

Run full health check:

```bash
npm run doctor
```

Run full verification:

```bash
npm run verify
```

Admin login:

```txt
POST /api/auth/admin/login
```

Default local demo PIN:

```txt
2026
```

Change `ADMIN_PIN` and `ADMIN_SESSION_SECRET` before production.

`verify` temporarily stops frontend dev server before `next build` and restarts it after completion to prevent `.next` cache corruption.

Fix Next.js cache issue:

```bash
npm run fix:frontend-cache
npm run dev:frontend
```

Run Prisma migration:

```bash
cd backend
npm run db:migrate
```

Generate Prisma client:

```bash
cd backend
npm run prisma:generate
```

## Known Resolved Issues

### Next.js missing chunk error

Example:

```txt
Cannot find module './611.js'
```

Cause:

```txt
Stale or corrupted frontend/.next cache
```

Fix:

```bash
npm run fix:frontend-cache
npm run dev:frontend
```

### Prisma DLL lock warning on Windows

Cause:

```txt
Backend process is running and locking Prisma query engine DLL.
```

Fix:

```txt
Stop backend, then run npm run doctor again.
```

This is not a database corruption issue.

## Architecture Notes

Backend:

- NestJS
- Prisma
- PostgreSQL
- Central `PrismaService`
- Auto-seeding via `DatabaseSeederService`
- Hardware simulation via `SimulatedHardwareService`
- Per-locker command queue
- DB-level conditional state updates
- Central HTTP exception filter
- API versioning
- Admin token guard
- Lightweight rate limiting guard
- Real-mode payment webhook signature check

Frontend:

- Next.js 15
- TypeScript
- Tailwind CSS
- Premium dark dashboard
- Optimistic updates
- Rollback on API error
- Error toast
- Backend is the source of truth

## Current API Routes

```txt
GET  /api/lockers
GET  /api/lockers/:id
POST /api/locker/open
POST /api/locker/close
POST /api/locker/demo-payment
POST /api/auth/admin/login
POST /api/integrations/1c/tariffs/import
POST /api/integrations/cctv/event
```

## Current Business Rules

Open locker:

- Only `AVAILABLE` or `RESERVED` lockers can open
- `OCCUPIED` lockers cannot open
- Already open lockers cannot open again

Close locker:

- Only open `RESERVED` lockers can close
- Closing changes locker to `OCCUPIED`
- Closing creates an active `Session` if one does not already exist

Demo payment:

- Only `AVAILABLE` lockers can start demo payment
- Demo payment creates an `ACTIVE` session
- PIN and QR payload are generated
- Locker becomes `OCCUPIED`
- Locker opens automatically through simulated hardware

## Day 3 MVP Additions

- API-driven fake payment simulation
- Frontend 5-second polling for realtime dashboard feel
- Optimistic UI updates and rollback on API failure
- Payment processing modal
- Payment success screen with PIN and QR-style access preview
- Persistent locker size metadata and access-log schema
- Premium analytics cards:
  - Total lockers
  - Active sessions
  - Occupied lockers
  - Available lockers
  - Demo revenue
- `verify` now temporarily stops frontend dev server before `next build` and restarts it afterwards to prevent `.next` cache corruption.

## Future Enterprise Architecture Constraint

Do not implement these yet during MVP:

- real payment providers
- ESP32 hardware integration
- relay control
- websocket infrastructure
- monitoring stacks
- AI analytics
- self-healing hardware systems

Keep code modular so these can be added later.

## Next Recommended Work

Day 3 should focus on:

- Kiosk user flow
- Language selector
- Rental duration
- Fake payment
- QR/PIN generation UI
- Session details screen
- Admin/session analytics
- WebSocket realtime updates
