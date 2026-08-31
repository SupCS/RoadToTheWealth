# RTTW repository instructions

These instructions apply to the entire repository. A more specific `AGENTS.md` may add rules for its subtree.

## Product invariants

- RTTW is local-first: core money workflows must not require a network connection.
- Never lose or silently mutate the original transaction amount, currency, date, or applied FX snapshot.
- Transfers between owned accounts are not income or expense.
- Imported rows must be previewed and deduplicated before being committed.
- Probable duplicates require user confirmation; only exact source-identical duplicates may be skipped automatically.
- Every server-side household query must be scoped and authorized by household membership.
- Russian locale uses language code `ru` but displays a pirate flag instead of the Russian national flag.
- User-selectable themes are data-driven design tokens. Do not hard-code feature colors in screens.
- Accessibility, readable contrast, and support for increased font size take priority over decorative styling.

## Architecture

- Mobile: Expo SDK 54, React Native, TypeScript. SDK 54 is temporary while physical-device testing uses the store version of Expo Go; reassess when development builds are introduced.
- API: Fastify and TypeScript, deployed as a stateless Railway service.
- Cloud database: Railway PostgreSQL.
- Device database: Expo SQLite (planned integration).
- API contracts and validation should use Zod when the first domain endpoint is introduced.
- Monetary values are stored as integer minor units plus an ISO 4217 currency code. Never use floating-point values for persisted money.
- Dates are ISO-8601. Financial posting dates are date-only values; audit timestamps are UTC instants.

## Change discipline

- Read the relevant file in `docs/` before changing domain behavior.
- Update documentation and tests in the same change as a requirement or schema change.
- Prefer small modules organized by domain, not a global folder of unrelated helpers.
- Keep secrets out of the repository. Document variables in `.env.example`.
- Do not add analytics, advertising, or third-party financial-data upload without explicit approval.
- Before handoff, run `npm run check` and the tests relevant to the change.

## Definition of done

- TypeScript passes with strict checking.
- Offline and reconnect behavior are considered for every write workflow.
- Loading, empty, error, and retry states are defined.
- New text exists in English, Ukrainian, and Russian.
- New UI works with every theme token set and does not depend on a specific palette.
- Sensitive logs contain no transaction descriptions, tokens, imported files, or personal identifiers.
