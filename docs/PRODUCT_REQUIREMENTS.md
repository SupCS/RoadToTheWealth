# RTTW product requirements v0.2

## 1. Product goal

Road To The Wealth is a private household finance application for two people. It provides a trustworthy view of balances, spending, income, budgets, goals, and progress while supporting several currencies and intermittent connectivity.

## 2. Supported platforms and locales

- Android and iOS from one Expo/React Native codebase.
- English (`en`) with `🇬🇧` in the language picker.
- Ukrainian (`uk`) with `🇺🇦`.
- Russian (`ru`) with `🏴‍☠️`; never show the Russian national flag.
- Locale affects UI text, date/number formatting, and category labels. It never changes stored financial values.
- A transaction description imported from a bank is preserved in its source language.

## 3. Household and identity

- On first local use, the app automatically creates the household data container and current local member so personal money workflows are immediately available offline. Inviting a partner remains explicit.
- Accounts may be personal or shared.
- No shared account is created automatically. A user may create multiple personal and shared accounts, and each account becomes shared only after an explicit choice during creation or editing.
- Household members can see shared data; personal-account visibility will be a configurable later policy.
- All mutations record creator, last editor, timestamps, and sync version.
- Authentication, invitation, and session design must work with the Railway API rather than a vendor-specific mobile SDK.

## 4. Accounts and transactions

Account types: cash, debit card, credit card, current account, savings, deposit, investment, debt, e-wallet, and custom.

Transaction types: expense, income, transfer, refund, adjustment, and debt payment.

Required transaction data:

- original amount in integer minor units;
- original ISO currency;
- account and household;
- transaction date and optional bank posting date;
- type, category, optional split lines, merchant/description, notes, tags;
- source (`manual`, `import`, `recurring`, later `bank_api`);
- applied FX rate, provider, and rate date when conversion is needed;
- base-currency amount calculated from the immutable FX snapshot;
- sync, review, and deletion states.

Transfers link two legs and do not affect income/expense reports. They preserve one amount and currency across both legs. An optional transfer fee is stored as a separate linked expense on the source account. Currency exchange inside an account is a separate operation that preserves both exchanged amounts, the applied rate snapshot, and fees.

## 5. Multi-currency behavior

- An account may hold balances in multiple enabled currencies and has one explicitly selected primary currency. Transactions retain their original currency and affect the matching currency balance inside the account. A derived account total may be shown in the primary currency only when every required current or cached rate is available, with the rate freshness made clear.
- A household has a base reporting currency, switchable without rewriting history.
- Users may temporarily display reports in any enabled currency.
- Historical rate is selected by transaction/posting date. On a non-publishing day, use the latest available rate on or before that date.
- Cache rates locally and refresh at most daily when online.
- Offline writes always succeed. Use a cached rate when valid or mark the transaction `fx_pending`; permit manual rates.
- Store the chosen rate snapshot with the transaction. Later provider changes never silently alter past totals.
- Initial provider: Frankfurter/ECB where supported. A provider interface must allow a fallback for unsupported currencies.

## 6. Manual entry

- Quick expense/income/transfer flow.
- Account, amount, currency, date, category, description/note, tags, and recurring option. The optional description stays in the primary entry flow directly below amount; it is not hidden under additional details.
- Split a transaction among several categories while preserving the original total.
- Duplicate/edit/delete from both a long-press transaction menu and the edit screen; destructive list actions offer undo.
- Collapsible filters by period, member, account, category, currency, tag, and source.
- Transaction rows lead with the selected category icon and category name, with the optional transaction description shown beneath it.

## 7. Statement import

MVP formats: CSV and XLSX. Later: OFX/QFX, bank-specific text PDF, scanned PDF/OCR, and bank APIs.

Import workflow:

1. Pick a local file.
2. Select destination account and optional saved bank template.
3. Detect encoding, delimiter, header row, columns, signs, date format, and currency.
4. Let the user correct mappings.
5. Normalize without committing data.
6. Preview new, probable-duplicate, exact-duplicate, invalid, and uncategorized rows.
7. Confirm selected rows.
8. Commit atomically and retain an import report.

Deduplication uses account, date, amount, currency, normalized description, direction, and bank transaction ID when present. Date plus amount alone is never sufficient for automatic removal.

Users can create deterministic merchant/category rules. Rules run locally and are explainable; AI categorization is out of MVP scope.

## 8. Categories, budgets, and recurring items

- Built-in localized income and expense categories; custom categories/subcategories require one user-entered name and support independently selectable fixed background colors, icon colors, and icons, plus archive and merge. Category appearance remains unchanged when the app theme changes. Built-in categories keep their localized names and behavior but allow appearance editing.
- Subcategories are analytical detail, not independent top-level reporting groups: dashboards roll their amounts into the parent category and let the user expand that parent for a subcategory breakdown. Direct parent spending appears as `General` in that breakdown. Pickers, filters, transaction rows, and category management preserve and display the parent-child relationship.
- Monthly household, member, and category budgets.
- Optional rollover and alerts at configurable thresholds.
- Recurring salary, rent, utilities, subscriptions, loans, and savings transfers.
- A recurring item may auto-create a planned record or issue a reminder.

## 9. Goals and wealth roadmap

A goal contains target amount/currency, saved amount, target date, priority, linked account, participants, and planned monthly contribution.

Show completion, remaining amount, required monthly contribution, expected completion date, and schedule variance.

A roadmap is an ordered/dependent set of goals, for example: repay expensive debt → one-month reserve → six-month reserve → major purchase → recurring investing.

## 10. Dashboard and reports

- Household balance and current-user balance are separate financial scopes throughout the product, not merely two labels for the same total. Household balance aggregates all household-visible accounts once; current-user balance aggregates only accounts personally owned by that user. Shared accounts belong to the household balance and are not silently included in the personal balance.
- The dashboard presents household balance and current-user balance as separate scopes. Until at least one active shared account exists, only the personal widget is shown; the technical household data container alone must not create a duplicate-looking household balance. Reports, filters, budgets, goals, and derived totals must preserve the selected scope and label it explicitly.
- Net worth, available cash, monthly income/expense, remaining budget, nearest goal, and recent activity.
- Configurable exchange-rate widget showing the household base currency against globally enabled currencies.
- Opening a currency pair shows its current value and historical movement; the initial view covers 30 days and may later support selectable periods.
- Trends by month, category, member, account, currency, and source.
- Cash flow, recurring commitments, goal progress, and end-of-month forecast.
- Original-currency and converted values remain inspectable.

Currency visibility is a global user preference: currencies disabled in Settings are hidden from the rate widget, selectors, and reports unless required to display an existing historical transaction.

## 11. Themes

Users can change themes at any time. The preference is local per device and may optionally synchronize per user.

Initial 12 combinations:

1. Wealth — emerald and gold
2. Ocean — blue and cyan
3. Grape — purple and violet
4. Sunset — orange and rose
5. Cherry — crimson and pink
6. Forest — green and lime
7. Arctic — ice blue and indigo
8. Lavender — lavender and magenta
9. Coffee — brown and amber
10. Graphite — slate and electric blue
11. Pirate — charcoal and gold
12. High Contrast — black, white, and yellow

Each theme defines semantic tokens for background, surface, text, muted text, primary, secondary/accent, positive, warning, danger, and border. Theme choice must not change the meaning of financial status colors. Contrast is validated, and the system should later support light/dark variants independently of accent choice.

## 12. Offline, sync, export, and recovery

- Device SQLite is the immediate source for UI reads/writes.
- An outbox retries idempotent mutations when connectivity returns.
- The Railway API stores the household source of truth in PostgreSQL and returns incremental changes.
- Soft deletion uses tombstones so deletions synchronize correctly.
- Conflict resolution is deterministic and never discards both versions silently.
- Export transactions as CSV and full data as versioned JSON.
- Validate backups before restore and retain the previous database until restore succeeds.

## 13. Security and privacy

- HTTPS only; short-lived access sessions and rotatable refresh sessions.
- Passwords use a modern password hash implemented on the server.
- Secrets use device secure storage; local app lock supports PIN/biometrics.
- Every API record is authorized by household membership.
- Imported bank files are processed locally by default and are not uploaded as raw files.
- No ads, trackers, transaction analytics, or AI upload without explicit informed consent.

## 14. Out of initial scope

- Direct bank integrations and open banking.
- Investment trading or financial advice.
- Cryptocurrency portfolio pricing.
- OCR for arbitrary scanned PDFs.
- Public multi-tenant release and paid subscriptions.
