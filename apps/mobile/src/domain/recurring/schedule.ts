import type { RecurringRule, Transaction } from '../../data/repositories/ledger-repository';

export type UpcomingRecurringItem = Readonly<{ rule: RecurringRule; transaction: Transaction; occurrenceDate: string }>;

export function nextOccurrence(rule: RecurringRule, afterDate: string): string | null {
  let step = 0;
  let candidate = rule.startsOn;
  while (candidate <= afterDate) {
    step += 1;
    candidate = addInterval(rule.startsOn, rule.frequency, rule.interval * step);
  }
  return rule.endsOn && candidate > rule.endsOn ? null : candidate;
}

export function buildUpcomingItems(rules: RecurringRule[], transactions: Transaction[], afterDate: string, throughDate: string, limit = Number.POSITIVE_INFINITY): UpcomingRecurringItem[] {
  const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  return rules.flatMap((rule) => {
    if (!rule.isActive) return [];
    const transaction = byId.get(rule.templateTransactionId);
    if (!transaction) return [];
    const items: UpcomingRecurringItem[] = [];
    let cursor = afterDate;
    let occurrenceDate = nextOccurrence(rule, cursor);
    while (occurrenceDate && occurrenceDate <= throughDate && items.length < limit) {
      items.push({ rule, transaction, occurrenceDate });
      cursor = occurrenceDate;
      occurrenceDate = nextOccurrence(rule, cursor);
    }
    return items;
  }).sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate)).slice(0, limit);
}

export function addDays(date: string, days: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return isoDate(new Date(Date.UTC(year, month - 1, day + days)));
}

function addInterval(date: string, frequency: RecurringRule['frequency'], interval: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (frequency === 'monthly') {
    const targetMonth = month - 1 + interval;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    return isoDate(new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))));
  }
  const days = frequency === 'weekly' ? interval * 7 : interval;
  return isoDate(new Date(Date.UTC(year, month - 1, day + days)));
}

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
