# Hardware Integration Plan

## MVP Mode

The current system uses a simulated hardware service. It returns realistic command results for open and close actions without requiring physical locks.

## Future Hardware

Expected components:

- ESP32 controller boards
- Relay modules
- Electronic cabinet locks
- QR scanner
- Touchscreen kiosk
- Payment terminal

## Recommended Protocol Path

For the first physical prototype, ESP32 HTTP endpoints are simple and fast:

- `POST /lockers/:number/open`
- `POST /lockers/:number/close`
- `GET /lockers/:number/status`

For mall-scale deployment, MQTT is better for multiple locker banks because it handles event streams and intermittent devices more cleanly.

## Integration Rule

The frontend should never talk to ESP32 devices directly. All hardware commands should go through the NestJS API so permissions, logging, payment validation, and analytics remain centralized.
