# Integration Readiness

Last updated: 2026-05-09

This project is now prepared for real external integrations while keeping the local MVP in safe mock mode.

## Current Integration Modes

Default local mode:

```txt
PAYMENT_MODE=MOCK
HARDWARE_MODE=MOCK
SMS_MODE=MOCK
ONE_C_MODE=FILE
CCTV_MODE=MANUAL
```

## Readiness Endpoint

```http
GET /api/integrations/status
X-API-Version: 1
```

Returns readiness for:

- Payme and Click credentials
- ESP32 hardware mode and health
- SMS provider credentials
- 1C export/API readiness
- CCTV event readiness
- server environment

## Payment Providers

Prepared providers:

- Payme
- Click

Prepared endpoint:

```http
POST /api/integrations/payment/webhook
X-API-Version: 1
Content-Type: application/json
```

Body:

```json
{
  "provider": "PAYME",
  "payload": {},
  "signature": "optional-provider-signature"
}
```

Required from provider before real activation:

- merchant/service IDs
- secret keys
- callback/webhook URL format
- signature verification rules
- transaction lifecycle docs
- test credentials

## ESP32 Hardware

Prepared modes:

- `MOCK`: current local simulator
- `ESP32`: HTTP adapter

Expected ESP32 endpoints:

```txt
GET  {ESP32_BASE_URL}/health
POST {ESP32_BASE_URL}/lockers/:lockerId/open
POST {ESP32_BASE_URL}/lockers/:lockerId/close
```

Optional auth:

```txt
Authorization: Bearer {ESP32_API_TOKEN}
```

Required from hardware team:

- controller IP/base URL
- auth token format
- locker number to relay channel map
- response examples for success/failure
- online/offline heartbeat behavior

## SMS

Prepared endpoint:

```http
POST /api/integrations/sms/test
X-API-Version: 1
Content-Type: application/json
```

Body:

```json
{
  "phone": "+998901234567",
  "message": "Your City Mall locker PIN is 123456"
}
```

Required before real activation:

- SMS provider name
- login/API key
- sender ID
- message template approval rules
- rate limits

Current MVP behavior:

- after successful payment, the backend queues an SMS message with locker number and PIN
- in `SMS_MODE=MOCK`, the message is logged and returned as preview data
- when `SMS_MODE=ESKIZ` and `NODE_ENV=production`, the backend logs in to Eskiz, caches the token, and sends SMS through `notify.eskiz.uz`
- local development does not send real SMS unless `SMS_ALLOW_LOCAL_SEND=true` is explicitly set
- default sender is `ESKIZ_SENDER=4546` unless an approved alpha-name is configured

## 1C

Prepared endpoint:

```http
GET /api/integrations/1c/export?from=2026-05-01T00:00:00.000Z&to=2026-05-09T23:59:59.999Z
X-API-Version: 1
```

Current output:

- JSON export of payments
- totals
- booking ID
- locker number
- provider/status/amount/currency/paidAt

Prepared tariff import endpoint:

```http
POST /api/integrations/1c/tariffs/import
X-API-Version: 1
Content-Type: application/json
```

Body:

```json
{
  "tariffs": [
    {
      "name": "Medium 2h",
      "lockerSize": "MEDIUM",
      "durationMinutes": 120,
      "price": 30000,
      "currency": "UZS",
      "isActive": true
    }
  ]
}
```

Current behavior:

- imports tariffs from JSON
- updates matching locker size, duration, and currency
- creates missing tariffs
- logs the import operation for audit

Required before real activation:

- 1C exchange format: JSON or XML
- API URL or file-drop path
- auth token/login
- required field names
- sync schedule
- tariff import format

## CCTV

Prepared endpoint:

```http
POST /api/integrations/cctv/event
X-API-Version: 1
Content-Type: application/json
```

Body:

```json
{
  "lockerId": "34",
  "event": "ACCESS_GRANTED",
  "cameraId": "CAM-LOCKERS-01"
}
```

Required before real activation:

- CCTV vendor/API docs
- camera IDs
- event bookmark API
- archive link format
- retention policy confirmation

Current MVP behavior:

- CCTV event endpoint stores audit logs
- response includes archive metadata and `CCTV_RETENTION_DAYS`
- default retention is 30 days to match the technical requirement

## Production Server

Before putting the system on the City Mall local server, prepare:

- static local IP or domain
- PostgreSQL username/password/database
- production `.env`
- backup path and schedule
- Windows service or Docker Compose startup
- firewall rules for frontend/backend/PostgreSQL
- SSL certificate if accessed outside LAN

Recommended final validation:

```bash
npm run doctor
npm run verify
npm run qa:smoke
```
