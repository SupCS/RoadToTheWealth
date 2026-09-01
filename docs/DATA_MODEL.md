# Initial data model

This is the conceptual schema; database migrations will become authoritative once persistence work starts.

## Core entities

- `users`: identity and account lifecycle.
- `households`: name, base currency, settings.
- `household_members`: membership and role.
- `devices`: sync cursor and revoked state.
- `accounts`: ownership scope (`personal` or `shared`), nullable personal owner, type, archive state, and one or more currency balances. A currency belongs to a balance within an account, not permanently to the account itself.
- `categories`: localized/custom label metadata, parent, income/expense applicability.
- `transactions`: type, dates, source, status, original money, reporting snapshot, description.
- `transaction_splits`: category allocations whose sum equals the transaction amount.
- `transfer_links`: links debit/credit legs and cross-currency details.
- `fx_rate_snapshots`: provider and effective historical rate.
- `import_batches`: parser/template/report metadata, never the raw file by default.
- `import_rows`: source fingerprint, normalized result, review outcome.
- `categorization_rules`: ordered deterministic match/action rules.
- `budgets`: scope, period, amount, rollover and warning thresholds.
- `recurring_rules`: schedule and generation policy.
- `goals`: target, linked account, dates, priority and status.
- `goal_contributions`: transaction-linked or manual progress entries.
- `roadmaps` and `roadmap_steps`: ordered/dependent goal plans.
- `sync_changes`: household-scoped monotonic change sequence.

## Money representation

Persist money as:

```text
amount_minor: signed 64-bit integer
currency_code: ISO 4217 code
```

Rate values are decimal strings/numeric database values, never binary floating point. Currency metadata defines minor-unit precision; do not assume every currency has two decimals.

## Required common columns

Synchronized entities generally include UUID, household ID, created/updated timestamps, creator/editor IDs, revision, and nullable deletion timestamp.

## Key invariants

- Transaction and split currencies/amounts reconcile exactly.
- A transfer moves an unchanged amount in one currency between two account currency balances. Currency exchange is a separate operation, not a cross-currency transfer.
- Transfer legs are linked and reports exclude their principal from income/expense.
- FX snapshots are immutable after confirmation unless an audited user correction occurs.
- Import fingerprint uniqueness is scoped to account/source, not globally.
- Server access always checks active household membership.
- Household and current-user balances are independently derived views: household balance includes each household-visible account once, while current-user balance includes only personal accounts owned by that user. A shared account is never silently counted as a user's personal balance.
- Shared financial accounts are always explicit records with `ownership_scope = shared`; initialization and onboarding never create one implicitly. A household may contain any number of personal and shared accounts.
