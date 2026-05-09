# Deployment

## Local Production Smoke Test

```bash
npm run verify
npm run dev:backend
npm run dev:frontend
```

Open:

- Frontend: `http://localhost:3000`
- Kiosk: `http://localhost:3000/terminal`
- Admin: `http://localhost:3000/admin`
- Backend: `http://localhost:4000/api/lockers`

## Environment Variables

Backend:

```txt
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/locker_system?schema=public
ADMIN_PIN=change-this
ADMIN_SESSION_SECRET=use-a-long-random-secret
PAYMENT_MODE=MOCK
SMS_MODE=ESKIZ
SMS_ALLOW_LOCAL_SEND=false
HARDWARE_MODE=MOCK
CCTV_RETENTION_DAYS=30
```

Frontend:

```txt
NEXT_PUBLIC_API_URL=https://your-backend-domain/api
NEXT_PUBLIC_SOCKET_URL=https://your-backend-domain
```

## Docker

```bash
docker compose up --build
```

The backend runs Prisma migrations before starting. The frontend is exported as static assets and served on port `3000`.

## Vercel

Deploy `frontend/` as the Vercel project root.

Set:

```txt
NEXT_PUBLIC_API_URL=https://your-backend-domain/api
NEXT_PUBLIC_SOCKET_URL=https://your-backend-domain
```

The backend should be deployed separately on a Node-capable host because it owns PostgreSQL, Prisma migrations, and Socket.io realtime events.

## Local Mall Computer Mode

For a single-computer pilot, the same Windows machine can run:

- PostgreSQL
- backend on port `4000`
- frontend on port `3000`
- kiosk browser at `/terminal`
- admin browser at `/login`

Required before daily operation:

- static Windows user login or kiosk mode
- automatic startup for PostgreSQL, backend, and frontend
- UPS for short power outages
- daily database backup path
- manual emergency opening procedure

## Acceptance Checklist

- `npm run verify` passes
- kiosk flow creates booking only after storage terms are accepted
- mock payment creates PIN and QR
- SMS is queued/logged after payment
- admin token is required for admin and locker command routes
- access logs record successful and failed PIN/QR attempts
- report export works for the selected period
- 1C tariff import accepts JSON payload
- CCTV event endpoint returns 30-day archive metadata
- local restart restores data from PostgreSQL
