# Operator Guide

Last updated: 2026-05-09

## Daily Start

1. Turn on the local server or kiosk computer.
2. Confirm PostgreSQL is running.
3. Start backend and frontend.
4. Open the kiosk page:

```txt
http://localhost:3000/terminal
```

5. Open admin login:

```txt
http://localhost:3000/login
```

## Admin Login

Use the configured `ADMIN_PIN`.

The demo PIN is:

```txt
2026
```

Change it before real operation.

## Customer Flow

1. Select language.
2. Select locker size.
3. Select storage duration.
4. Enter phone number.
5. Accept storage terms and restrictions.
6. Select available locker.
7. Pay.
8. Receive PIN and QR code.

In mock mode, payment and SMS are simulated.

## Storage Rules Shown In Kiosk

- maximum storage duration is 24 hours
- dangerous, flammable, illegal, and perishable items are prohibited
- the customer must not share PIN/QR access code

## Emergency Actions

Use the admin panel for:

- remote open
- remote close
- release locker
- mark expired
- maintenance mode
- regenerate/revoke access code

All actions are logged.

## If The Computer Turns Off

Data stays in PostgreSQL. After restart, run the backend and frontend again.

For real operation, use:

- UPS
- automatic startup
- database backup
- manual/mechanical emergency opening process
