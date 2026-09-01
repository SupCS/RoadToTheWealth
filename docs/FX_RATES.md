# FX rate policy

## Supported currencies

The mobile catalog currently contains CHF, EUR, GBP, GEL, JPY, KWD, PLN, RUB, TRY, UAH, and USD. All eleven codes were verified against the Frankfurter v2 currency catalog on 2026-09-01.

ECB reference rates directly cover CHF, GBP, JPY, PLN, TRY, and USD against EUR. They do not directly cover GEL, KWD, or UAH, and publication of the EUR/RUB reference rate has been suspended since 2022-03-01. Frankfurter aggregates additional central-bank providers and is therefore the application adapter rather than a direct ECB-only integration.

## Resolution and fallback

For a transaction whose original currency differs from the household reporting currency:

1. Reuse an exact SQLite snapshot for the currency pair and requested transaction date.
2. Otherwise request Frankfurter history and select the latest published rate whose date is not later than the transaction date. The ten-day lookback covers ordinary weekends and bank-holiday runs.
3. Persist the requested date, effective publication date, decimal rate, provider, and fetch timestamp in SQLite.
4. If neither the cache nor network can provide a rate, save the original transaction unchanged with `fx_pending`. A later checklist item will add automatic retry and manual-rate entry.

The transaction stores its own FX snapshot and reporting amount. Subsequent market-rate updates must never rewrite that snapshot or the original amount.

Latest-rate widgets reuse a result for 24 hours and fall back to the last cached result when refresh fails.

## Numeric rules

Persisted money remains integer minor units. Decimal FX rates are stored as strings and conversion uses integer arithmetic with half-up rounding; floating-point values are not persisted as money.
