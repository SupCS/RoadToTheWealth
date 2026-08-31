# Decisions and open questions

## Accepted

- Mobile stack: Expo/React Native/TypeScript.
- Backend hosting: Railway Hobby plan.
- Server: stateless Fastify API plus Railway PostgreSQL.
- Offline-first local SQLite with eventual synchronization.
- Three locales: English, Ukrainian, Russian; pirate flag represents Russian in the picker.
- Twelve initial selectable color palettes.
- Android Studio is optional during early development.
- Raw statement parsing occurs locally by default.

## Decisions required before relevant milestones

- Exact currencies and banks used by both household members.
- Which bank statement samples/formats are available for test fixtures after anonymization.
- Whether personal accounts can be hidden from the other member or the household is fully transparent.
- Whether base-currency historical reports remain pinned forever or support an explicit audited recalculation.
- Backup destination and encryption/recovery model.
- Authentication method: email/password first, passkeys later, or invitation code plus email.
- Required minimum Android/iOS versions at release time.

