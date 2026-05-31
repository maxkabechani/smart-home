# Temperature & Humidity Monitor

Full stack project for an ESP32-based temperature and humidity monitor.

## Project layout

- apps/backend: Fastify API + SQLite (Drizzle)
- apps/web: Next.js dashboard
- apps/mobile: Flutter client
- esp32: ESP32 sketch (esp32.ino)

## Prerequisites

- Node.js (with pnpm)
- Flutter SDK (for apps/mobile)
- Arduino IDE or PlatformIO (for esp32/esp32.ino)

## Environment variables

Backend (apps/backend):

- PORT: API port (default 4000)
- HOST: bind host (default 0.0.0.0)
- DB_FILE_NAME: SQLite file name (default temperature-humidity.sqlite)
- READING_STALE_AFTER_SECONDS: mark sensor as offline after this many seconds (default 30)

Web (apps/web):

- NEXT_PUBLIC_API_BASE_URL: backend base URL (default http://localhost:4000)

## Install

From repo root:

- pnpm -C apps/backend install
- pnpm -C apps/web install

## Run locally

Backend:

- pnpm -C apps/backend dev

Web:

- pnpm -C apps/web dev

Mobile:

- flutter pub get (in apps/mobile)
- flutter run

## API endpoints

- GET /readings/latest
- POST /readings

## ESP32

The sketch lives in esp32/esp32.ino. Configure your Wi-Fi credentials and the backend URL in that sketch before flashing the board.
