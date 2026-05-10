# Google Sheets integration

Google Sheets can replace the 1C MVP exchange for bookings, payments, and tariff import.

## Sheet structure

Create one spreadsheet with two tabs:

### Payments

Header row:

```text
Date | Booking ID | Locker | Phone | Duration | Amount | Currency | Provider | Payment Status | Paid At | PIN | Source
```

The backend appends one row after each successful payment when `GOOGLE_SHEETS_MODE=ENABLED`.

### Tariffs

Header row:

```text
Name | Size | Duration Minutes | Price | Currency | Active
```

Example rows:

```text
Small 1 hour | SMALL | 60 | 10000 | UZS | TRUE
Medium 1 hour | MEDIUM | 60 | 15000 | UZS | TRUE
Large 1 hour | LARGE | 60 | 20000 | UZS | TRUE
```

Valid sizes are `SMALL`, `MEDIUM`, and `LARGE`.

## Google Cloud setup

1. Create or open a Google Cloud project.
2. Enable `Google Sheets API`.
3. Create a Service Account.
4. Create a JSON key for that Service Account.
5. Share the spreadsheet with the Service Account email as `Editor`.
6. Copy the spreadsheet id from the URL.

## Backend environment

Add these values to `backend/.env`:

```env
GOOGLE_SHEETS_MODE=ENABLED
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_PAYMENTS_SHEET=Payments
GOOGLE_SHEETS_TARIFFS_SHEET=Tariffs
```

Keep the private key on one line with `\n` newlines.

## API endpoints

Check status:

```http
GET /integrations/status
```

Manually sync existing payments:

```http
POST /integrations/google-sheets/payments/sync
POST /integrations/google-sheets/payments/sync?from=2026-05-01&to=2026-05-10
```

Import tariffs from the `Tariffs` tab:

```http
POST /integrations/google-sheets/tariffs/import
```
