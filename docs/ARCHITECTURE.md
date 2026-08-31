# Architecture

## System shape

```text
Expo mobile app
  ├─ UI and domain services
  ├─ local SQLite read model
  ├─ mutation outbox
  ├─ FX and import caches
  └─ sync client
           │ HTTPS
           ▼
Railway Fastify API
  ├─ authentication and sessions
  ├─ household authorization
  ├─ idempotent command endpoints
  ├─ incremental sync endpoint
  └─ scheduled FX refresh (later)
           │
           ▼
Railway PostgreSQL
```

## Mobile boundaries

Planned domains under `apps/mobile/src`:

- `app`: composition, navigation, providers, startup;
- `features`: transaction, import, budget, goal, settings flows;
- `domain`: money, FX, transaction, account, and sync rules;
- `data`: SQLite repositories, migrations, remote API, sync outbox;
- `design`: themes, components, spacing, typography;
- `i18n`: locale dictionaries and formatting;
- `shared`: generic utilities with no domain ownership.

UI components do not call HTTP or SQL directly. Domain money logic must be pure and testable.

## Railway API

The API is a stateless Node service. Railway supplies `PORT` and `DATABASE_URL`. Health endpoints must not expose configuration. All mutation endpoints eventually accept an idempotency key/device operation ID.

The API owns authentication, authorization, validation, server audit metadata, and synchronization ordering. It does not own UI-specific formatting.

## Synchronization outline

1. A mobile mutation commits to SQLite with a UUID and enters an outbox in one local transaction.
2. The UI updates immediately.
3. The sync worker sends ordered operations with stable idempotency IDs.
4. The server validates household access, commits once, and assigns a server sequence.
5. The client requests changes after its last sequence and applies them in a local transaction.
6. Tombstones propagate deletions.

Precise conflict policy will be written before sync implementation. Financial records favor explicit conflict review over destructive last-write-wins.

## FX

Provider adapters return decimal string rates and metadata. Conversion uses decimal arithmetic and rounds only at target minor-unit boundaries. A stored transaction snapshot includes provider, requested date, effective rate date, base/quote, and rate.

## Import safety

Parsers produce an intermediate normalized representation. Validation, duplicate scoring, mapping preview, and atomic commit are separate stages. Raw bank files stay on-device unless the user explicitly exports or backs them up.

