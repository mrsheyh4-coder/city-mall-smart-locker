# City Mall Smart Locker MVP

Verified public repository for Abdulaziz's Kwork portfolio.

## Status

- Repository: public
- Live URL: not verified
- Portfolio category: Smart Retail, IoT-ready Platform, Admin Dashboard, Booking System, Real-time System
- Security scan: no real API tokens found in current files or public branch history on 2026-06-27

## Overview

City Mall Smart Locker is a premium MVP for a scalable smart locker ecosystem. It includes a customer/admin dashboard foundation, booking and access-code flows, API-ready backend services, PostgreSQL/Prisma data modeling, and future hardware integration planning.

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, App Router
- Backend: NestJS, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Realtime: Socket.io-ready architecture
- Deployment config: Render

## Main Features

- Smart locker dashboard
- Locker status overview
- Booking creation flow
- QR/PIN access-code logic
- Admin statistics
- Payment integration readiness
- SMS/verification integration readiness
- Hardware-ready adapter structure for future ESP32 relay control
- Database schema for lockers, bookings, payments, access codes, logs, users, admins, and sessions

## Project Structure

```text
backend/    NestJS API foundation
database/   Prisma schema and database assets
docs/       Architecture, deployment, security, and integration notes
frontend/   Next.js dashboard and presentation layer
scripts/    QA, demo, backup, and development utilities
```

## Local Setup

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
npm install
npm run dev:backend:watch
npm run dev:frontend
```

## Verification Commands

```bash
npm run verify
npm run qa:smoke
```

## Security Notes

- Do not commit real `.env` values.
- Documentation and `.env.example` files may contain placeholder private-key formatting examples only.
- Real Payme, Click, Google, Eskiz, Telegram, database, and JWT credentials must stay in deployment secrets.

## Portfolio Use

Use this project as proof for:

- Admin dashboards
- Booking systems
- Real-time management interfaces
- API architecture
- PostgreSQL/Prisma data modeling
- IoT-ready business automation
