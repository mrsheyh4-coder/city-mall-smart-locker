# Frontend Change Log

This file tracks frontend-facing work for monthly reporting. Use it to prepare a before/after presentation later.

## 2026-05-09

### Premium UI redesign
- Reworked the app into a premium luxury mall style.
- Standardized the visual palette around:
  - Dark background: `#1a212f`
  - Bronze accent: `#b3806e`
  - White text/light elements: `#ffffff`
- Updated shared UI foundation:
  - global background
  - cards
  - buttons
  - inputs
  - modal surfaces
  - error toast
- Added glassmorphism, bronze glow, dark cards, soft shadows, hover transitions, and cleaner spacing.

### Customer terminal
- Redesigned the customer kiosk into a fullscreen premium terminal UI.
- Preserved the booking flow:
  - language selection
  - locker/yashik size selection
  - duration selection
  - phone number entry
  - locker/yashik selection
  - fake payment
  - booking success
- Added real scannable QR rendering with `qrcode.react`.
- Added PIN / QR access flow so a customer can open an existing booking by entering locker number and PIN/QR credential.
- Added realtime updates through Socket.io listeners.
- Kept inactivity auto reset.
- Fixed Russian terminal text encoding.

### Main dashboard
- Redesigned the main locker/yashik dashboard with premium dark styling.
- Replaced Uzbek wording from "locker" style labels to "yashik/yashiklar" where appropriate.
- Added realtime locker refresh via Socket.io events.
- Improved locker/yashik cards:
  - premium dark card design
  - bronze status accents
  - animated door visual
  - cleaner PIN/customer/expiry fields
  - language-aware demo customer names
- Changed demo customer display by selected language:
  - Uzbek: `Demo mijoz`
  - Russian: `Демо клиент`
  - English: `Demo customer`

### Admin dashboard
- Redesigned the admin dashboard into a premium enterprise dark UI.
- Added animated statistic counters.
- Improved revenue chart styling for dark/bronze theme.
- Added search for active bookings.
- Added search for locker/yashik monitoring.
- Added status filters for locker/yashik monitoring.
- Added pagination for active bookings.
- Added pagination for locker/yashik monitoring.
- Changed locker/yashik monitoring to show all lockers instead of only lockers attached to bookings.
- Added PIN / QR access history panel.
- Improved logs, tariffs, admin users, and active booking cards.

### Admin TZ completion pass
- Expanded admin dashboard from monitoring into operational management.
- Added booking management actions:
  - extend by 60 minutes
  - complete booking
  - cancel booking
  - status filtering
- Added tariff management actions:
  - create tariff
  - update tariff
  - delete tariff
  - active/inactive control
- Added financial reports area with revenue, bookings, access success rate, utilization rate, and JSON export.
- Added staff alerts for maintenance/offline lockers, bookings ending soon, failed access attempts, and system errors.
- Added PIN/QR access management with revoke and regenerate actions.
- Added log level filtering and timestamps.

### Localization and wording
- Fixed Russian translation text encoding in shared dashboard translations.
- Added `demoCustomer` translation key.
- Kept Uzbek-first wording for visible locker labels where requested.

### Cache and local development
- Disabled webpack cache during Next.js dev mode to reduce stale runtime bundle issues.
- Added clean frontend dev scripts:
  - root: `npm run dev:frontend:clean`
  - frontend: `npm run dev:clean`
- Added `npm run stop:dev` to clean stale Smart Locker Node/Nest/Next processes on Windows.
- Improved frontend cache reset so stale Next wrapper processes are stopped before `.next` cleanup.
- Continued using local development only. No deployment was performed.

### Verification
- Ran frontend lint successfully.
- Ran frontend production build successfully.
- Ran backend build successfully during related integration checks.
- Smoke-tested booking, fake payment, PIN access verification, and release flow.
- Ran full `npm run verify` successfully after stability fixes.

### Notes for future before/after report
- Before: UI was functional but closer to a generic dark/admin prototype, with partial light dashboard sections and decorative QR preview.
- After: UI is premium mall-style, language-aware, realtime-friendly, and has working booking plus PIN/QR access demo flow.
- Before/after screenshots should be captured later from:
  - `/`
  - `/terminal`
  - `/admin`
  - `/login`
