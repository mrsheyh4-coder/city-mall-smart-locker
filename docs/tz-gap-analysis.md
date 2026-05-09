# TЗ Gap Analysis

Last updated: 2026-05-09

## Implemented

- self-service kiosk flow
- Uzbek, Russian, and English language selection
- locker size and duration selection
- storage terms and restrictions confirmation
- booking creation
- tariff management
- PIN and QR access generation
- PIN/QR verification
- SMS queue/preview after payment
- locker state monitoring
- local admin panel
- admin authentication
- remote open/close and maintenance controls
- usage statistics
- financial report foundation
- access code management
- action and access logs
- 24-hour maximum booking validation
- PostgreSQL persistence
- realtime dashboard updates
- 1C JSON payment export
- 1C JSON tariff import
- CCTV event endpoint with 30-day archive metadata
- Payme/Click webhook readiness
- ESP32 HTTP adapter readiness

## Partially Implemented

- real payments: provider endpoints are prepared, but Payme/Click credentials and exact signature rules are still required
- SMS: booking/payment flow queues SMS, but real SMS provider credentials and sender rules are required
- CCTV: event logging and archive metadata exist, but vendor API and camera archive URLs are required
- 1C: JSON export/import exists, but final 1C field mapping, XML format, or file-drop rules must be confirmed
- mobile access for staff: admin panel is responsive, but there is no separate native mobile app
- protected server for logs: application logs are persisted, but infrastructure-level protected log server is a deployment task

## Not Implementable Without External Inputs

- real bank card terminal integration
- Apple Pay and Google Pay
- Payme/Click production payment lifecycle
- international booking platform integration such as Bounce or selected alternative
- real ESP32 relay/channel mapping
- real CCTV video monitoring and 30-day archive verification
- production availability guarantee of 99.5 percent
- UPS and power backup validation
- official license transfer documents
- operational training sign-off

## Recommended Next Order

1. Connect Payme/Click test credentials.
2. Connect SMS provider credentials.
3. Test ESP32 controller with real relay map.
4. Confirm 1C JSON/XML schema.
5. Confirm CCTV vendor API and camera IDs.
6. Deploy on local LAN server with backup and auto-start.
7. Run acceptance testing with mall staff.
