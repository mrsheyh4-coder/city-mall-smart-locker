# Architecture

## Product Shape

The MVP is intentionally split into a frontend dashboard, backend API, database schema, and docs. This keeps the City Mall presentation polished while preserving a path to production deployment.

## Backend Modules

- `lockers`: owns locker state transitions, API routes, Prisma reads, and Prisma writes.
- `hardware`: isolates simulated open and close commands from locker business logic.
- `prisma`: centralized PostgreSQL connection and first-launch seeding.
- `config`: reserved for environment validation and deployment configuration.

## API Foundation

Current routes:

- `GET /api/lockers`
- `GET /api/lockers/:id`
- `POST /api/locker/open`
- `POST /api/locker/close`
- `POST /api/locker/demo-payment`

The frontend consumes these routes as the source of truth. It performs optimistic updates and rolls back when the API rejects a command.

The demo payment route is a software-only simulation for the City Mall MVP. It does not integrate Payme, Click, Stripe, bank APIs, ESP32, relays, or physical hardware.

## Scaling To 60+ Lockers

The existing model supports a larger locker grid through stable locker numbers, status-based indexing, and a dedicated hardware adapter. The next data model expansion should add locker banks, floors, dimensions, sessions, payments, access credentials, and event logs.

## Future ESP32 Integration

The `hardware` module should evolve into an adapter layer:

Current implementation now includes:

- `HardwareService` facade
- `SimulatedHardwareService` for local demo mode
- `Esp32HardwareService` for future HTTP relay controllers
- `HARDWARE_MODE=MOCK|ESP32`

Integration status is exposed through:

```txt
GET /api/integrations/status
```

See `docs/integration-readiness.md` for provider-specific activation details.

- `SimulatedHardwareService` for demos and tests
- `Esp32HttpHardwareService` for direct controller calls
- `MqttHardwareService` for scalable mall deployments

Locker state should always be changed through backend commands, never directly from the frontend.
