# Presentation readiness - 2026-05-12

This checklist is for the full City Mall Smart Locker presentation on 2026-05-12.

## Demo links

- Frontend: `http://localhost:3000`
- Terminal: `http://localhost:3000/terminal`
- Admin login: `http://localhost:3000/login`
- Admin PIN: `2026`
- Backend health: `http://localhost:4000/api/health`

## Must-pass checks

Run before every presentation or deploy:

```powershell
npm run verify
npm run qa:smoke
npm run qa:ui
```

Expected result: all three commands finish with `[OK]` and no failures.

## Presentation flow

1. Open home page and show language switch.
2. Open Terminal.
3. Choose language.
4. Choose locker size.
5. Choose duration.
6. Enter phone number.
7. Send SMS code.
8. Enter demo SMS code shown on screen.
9. Accept storage terms.
10. Select an available locker.
11. Run mock payment.
12. Show 6-digit PIN and QR.
13. Open with PIN/QR from terminal access screen.
14. Open Admin panel.
15. Show metrics, bookings, locker monitoring, logs, access management, tariffs, and reports.
16. Press `+60 daqiqa` on an expired booking and show notification.
17. Open/close/release/expire/maintenance a locker and show notification history.
18. Export JSON report.

## Data safety

- Production data must live in PostgreSQL.
- Deploy must run `prisma migrate deploy`, not reset.
- Never run `prisma migrate reset`, `docker compose down -v`, or `DROP DATABASE` on production.
- Use `npm run backup:db` for manual backup.
- Daily backup setup is documented in `docs/database-backup-and-rollback.md`.

## Current verified behavior

- 60 demo lockers are seeded.
- Booking requires accepted terms and SMS verification.
- PIN generation is 6 digits.
- Mock payment creates payment/session and opens locker.
- Expired access is rejected.
- Expired booking can be extended by `+60 daqiqa`.
- Admin action notifications are recorded in the admin panel.
- Google Sheets integration is prepared but disabled until credentials are added.
