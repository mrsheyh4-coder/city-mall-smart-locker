# Security Readiness

Last updated: 2026-05-09

The MVP now has a practical security baseline for a controlled City Mall pilot.

## Implemented

- Backend-issued admin session token
- Admin PIN validation through `POST /api/auth/admin/login`
- Admin token guard for admin routes and direct locker hardware commands
- Request rate limits for admin login, booking creation, mock payment, access verification, payment webhooks, SMS test, and CCTV events
- Payment webhook signature enforcement when `PAYMENT_MODE` is not `MOCK`
- Mock payment disabled outside `PAYMENT_MODE=MOCK`
- Repeated failed PIN/QR access lockout per locker
- Cryptographically generated PINs
- QR access payloads no longer include the PIN
- Basic API security headers
- Audit logging for important admin, access, payment, booking, and hardware actions

## Protected Routes

These routes require an admin bearer token:

```txt
POST /api/locker/open
POST /api/locker/close
POST /api/locker/release
POST /api/locker/expire
POST /api/locker/maintenance
GET  /api/admin/statistics
GET  /api/admin/bookings
POST /api/admin/bookings/:id/complete
POST /api/admin/bookings/:id/cancel
POST /api/admin/bookings/:id/extend
POST /api/admin/tariffs
PUT  /api/admin/tariffs/:id
DELETE /api/admin/tariffs/:id
POST /api/admin/access-codes/:id/revoke
POST /api/admin/access-codes/:id/regenerate
GET  /api/admin/reports
POST /api/demo/reset
```

## Required Production Changes

Change these before real deployment:

```txt
ADMIN_PIN
ADMIN_SESSION_SECRET
PAYMENT_MODE
PAYME_MERCHANT_ID
PAYME_SECRET_KEY
CLICK_SERVICE_ID
CLICK_MERCHANT_ID
CLICK_SECRET_KEY
```

Use a long random `ADMIN_SESSION_SECRET`. Do not reuse the demo PIN in production.

## Payment Notes

In `PAYMENT_MODE=MOCK`, unsigned webhook payloads are accepted for local demos.

In real payment mode, Payme and Click webhook payloads must include a valid signature. The current signature verifier uses HMAC-SHA256 over a stable JSON payload as a safe default. When final Payme/Click merchant documents arrive, adapt the verifier to the exact provider signature rules.

## Remaining Before Public Internet Exposure

- HTTPS termination
- Firewall rules
- Database backup policy
- Real Payme/Click signature format mapping
- Optional persistent admin users with password hashing and role management
- Centralized monitoring and alerting
