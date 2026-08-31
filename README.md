# Road To The Wealth (RTTW)

RTTW is a private, local-first mobile budget application for a household of two. It combines manual transaction tracking, bank statement imports, historical multi-currency accounting, budgets, savings goals, and a step-by-step wealth roadmap.

## Status

The repository is initialized as an executable foundation and product specification. The mobile app currently contains a working theme/language preview; finance storage and synchronization are the next implementation milestone.

## Repository layout

```text
apps/mobile/    Expo + React Native + TypeScript application
apps/api/       Fastify + TypeScript API intended for Railway
docs/           Product, architecture, data, and delivery specifications
AGENTS.md       Rules for coding agents working in this repository
```

## Quick start — no Android Studio required

Prerequisites:

- Node.js 22.13 or newer (Node 24 is already suitable)
- npm
- Git
- Expo Go installed on a physical Android or iPhone
- the computer and phone connected to the same network

Run the mobile application:

```bash
npm run mobile
```

Scan the QR code with Expo Go. If the phone cannot reach the computer, use:

```bash
cd apps/mobile
npx expo start --tunnel
```

Run the API locally:

```bash
cd apps/api
copy .env.example .env
npm run dev
```

Check both TypeScript projects:

```bash
npm run check
```

## Do I need Android Studio?

No, not for the current development loop. A physical phone with Expo Go is enough for UI, navigation, business logic, networking, SQLite, file picking, and most device testing.

Android Studio becomes useful when you need an Android emulator, native Gradle debugging, custom native modules, or fully local release builds. Install it only when one of those requirements appears. Cloud development builds through EAS are another option.

## Railway deployment model

Create two Railway services in the same project:

1. A PostgreSQL service.
2. An API service whose root directory is `apps/api`.

Railway provides `DATABASE_URL` to the API service through a variable reference. The API must remain stateless; PostgreSQL stores synchronized household data. Mobile devices keep a local SQLite database and synchronize when online.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/RAILWAY.md](docs/RAILWAY.md).

## Product documentation

- [Step-by-step development checklist](CHECKLIST.md)
- [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Roadmap](docs/ROADMAP.md)
- [Development setup](docs/DEVELOPMENT.md)
- [Decisions and open questions](docs/DECISIONS.md)
