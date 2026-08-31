# Delivery roadmap

## M0 — foundation (current)

- Repository, Expo app, Railway API skeleton, agent rules, specifications.
- Executable theme and language preview.
- Type checking and environment templates.

## M1 — offline ledger

- Navigation and reusable design system.
- SQLite migrations/repositories.
- Household profile, accounts, categories.
- Manual expense, income, transfer, split transaction.
- Transaction list/search and base dashboard.
- Separate household-balance and current-user-balance queries and dashboard widgets, with explicit scope in downstream reports.
- Unit tests for money and transfer rules.

Exit: two people can use one device offline without losing accounting correctness.

## M2 — currency engine

- Currency metadata and formatting.
- Frankfurter/ECB adapter plus provider fallback interface.
- Historical rate cache, weekend fallback, manual/pending rate.
- Immutable conversion snapshots and report-currency switching.

Exit: historical reports remain stable offline across the required currencies.

## M3 — Railway identity and sync

- PostgreSQL migrations and server repositories.
- Registration/login, refresh sessions, household invitation.
- Idempotent outbox and incremental sync.
- Conflict review, tombstones, reconnect tests.

Exit: two devices converge after offline edits without silent loss.

## M4 — bank import

- CSV/XLSX picker and parsers.
- Mapping UI and reusable bank templates.
- Duplicate scoring and atomic preview/commit.
- Categorization rules and import report.

Exit: repeat import does not create exact duplicates and uncertain matches remain user-controlled.

## M5 — planning

- Category/household budgets and rollover.
- Recurring transactions and local reminders.
- Goals, contributions, projections, and roadmap steps.
- Expanded analytics and filters.

## M6 — hardening and distribution

- Encrypted/versioned backup and tested restore.
- Accessibility, performance, security review, translations.
- Development builds, store assets, privacy documentation.
- Bank-specific PDF adapters only for agreed banks.
