import type { Locale } from './translations';

const intlLocales: Record<Locale, string> = {
  en: 'en-GB',
  uk: 'uk-UA',
  ru: 'ru',
};

export function getIntlLocale(locale: Locale) {
  return intlLocales[locale];
}

export function formatDecimal(value: number, locale: Locale, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits,
  }).format(value);
}

export function formatRate(value: number, locale: Locale) {
  return formatDecimal(value, locale, 5);
}

export function formatPercent(value: number, locale: Locale, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits,
    style: 'percent',
  }).format(value);
}

export function formatDate(isoDate: string, locale: Locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error('Expected an ISO date in YYYY-MM-DD format');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Invalid calendar date');
  }
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(isoDateTime: string, locale: Locale) {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid ISO date-time');
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
