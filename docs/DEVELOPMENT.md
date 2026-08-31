# Development setup

## Required

- VS Code
- Git
- Node.js 22.13+ and npm
- Expo Go on a physical phone

Android Studio is optional. Use it only for an emulator, native Android debugging, or local Gradle/release builds. Day-to-day Expo development can use a real device.

## Mobile

```bash
cd apps/mobile
npm install
npm start
```

Scan the QR code with Expo Go. Both devices should usually be on the same network. If LAN discovery fails, try `npx expo start --tunnel`.

## API

```bash
cd apps/api
npm install
copy .env.example .env
npm run dev
```

The initial API does not require PostgreSQL for `/health`; domain routes will require `DATABASE_URL` when added.

## Environment policy

- `EXPO_PUBLIC_API_URL` is public configuration and must never contain a secret.
- Server secrets exist only in Railway variables or local ignored `.env` files.
- Commit `.env.example`, never `.env`.

## Before committing

```bash
npm run check
```

