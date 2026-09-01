import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Account, Category, Transaction } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { Card, ErrorState, LoadingState, MoneyText } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { formatMoney, type Money } from '@/src/domain/money/money';
import { deriveReportingAmounts } from '@/src/fx/reporting-amounts';
import { formatDate } from '@/src/i18n/formatters';
import { useSettings } from '@/src/settings/settings-context';

type Period = 'day' | 'week' | 'month' | 'year';
type ReadyState = {
  accounts: Account[];
  balances: Money[];
  categories: Category[];
  hasSharedAccounts: boolean;
  memberId: string | null;
  transactions: Transaction[];
};
type LoadState = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & ReadyState);

export function DashboardOverview() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const router = useRouter();
  const { baseCurrency, financialScope, locale, setFinancialScope, t, theme } = useSettings();
  const [period, setPeriod] = useState<Period>('month');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reportingAmounts, setReportingAmounts] = useState<Record<string, Money>>({});

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      if (!household) {
        setState({ status: 'ready', accounts: [], balances: [], categories: [], hasSharedAccounts: false, memberId: null, transactions: [] });
        return;
      }
      const member = await repository.getActiveMember(household.id);
      const [accounts, categories, transactions] = await Promise.all([
        repository.listAccounts(household.id),
        repository.listCategories(household.id),
        repository.listTransactions(household.id),
      ]);
      const hasSharedAccounts = accounts.some((account) => account.ownershipScope === 'shared' && !account.isArchived);
      const effectiveScope = financialScope === 'household' && hasSharedAccounts ? 'household' : 'personal';
      const balances = effectiveScope === 'household'
        ? await repository.getBalances({ kind: 'household', householdId: household.id })
        : member ? await repository.getBalances({ kind: 'personal', householdId: household.id, memberId: member.id }) : [];
      setState({ status: 'ready', accounts, balances, categories, hasSharedAccounts, memberId: member?.id ?? null, transactions });
      setReportingAmounts({});
      void deriveReportingAmounts(db, transactions, baseCurrency).then(setReportingAmounts).catch(() => undefined);
    } catch {
      setState({ status: 'error' });
    }
  }, [baseCurrency, db, financialScope, repository]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (state.status === 'loading') return <Card><LoadingState label={t('loadingDashboard')} /></Card>;
  if (state.status === 'error') return <Card><ErrorState message={t('dashboardLoadError')} onRetry={() => void load()} retryLabel={t('retry')} /></Card>;

  const effectiveScope = financialScope === 'household' && state.hasSharedAccounts ? 'household' : 'personal';
  const accountIds = new Set(state.accounts.filter((account) => effectiveScope === 'household'
    ? !account.isArchived
    : !account.isArchived && account.ownershipScope === 'personal' && account.ownerMemberId === state.memberId).map((account) => account.id));
  const range = getPeriodRange(period);
  const visible = state.transactions.filter((transaction) => accountIds.has(transaction.accountId)
    && transaction.transactionDate >= range.start && transaction.transactionDate <= range.end
    && transaction.status !== 'planned');
  const expenseMinor = sumType(visible, reportingAmounts, 'expense');
  const incomeMinor = sumType(visible, reportingAmounts, 'income');
  const categoryRows = buildCategoryRows(visible, reportingAmounts, state.categories, locale);
  const recent = state.transactions.filter((transaction) => accountIds.has(transaction.accountId)).slice(0, 3);

  return <>
    {state.hasSharedAccounts ? <View accessibilityRole="radiogroup" style={[styles.scopePicker, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {(['personal', 'household'] as const).map((scope) => {
        const active = effectiveScope === scope;
        return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={scope} onPress={() => setFinancialScope(scope)} style={[styles.scopeOption, active && { backgroundColor: theme.primary }]}>
          <MaterialCommunityIcons color={active ? theme.onPrimary : theme.muted} name={scope === 'personal' ? 'account-outline' : 'account-group-outline'} size={18} />
          <Text style={[styles.scopeText, { color: active ? theme.onPrimary : theme.text }]}>{t(scope === 'personal' ? 'personalScope' : 'householdScope')}</Text>
        </Pressable>;
      })}
    </View> : null}

    <Pressable accessibilityRole="button" onPress={() => router.push('/accounts' as Href)} style={({ pressed }) => [styles.balanceCard, { backgroundColor: theme.primary, opacity: pressed ? 0.88 : 1 }]}>
      <View style={styles.balanceHeading}>
        <Text style={[styles.balanceLabel, { color: theme.onPrimary }]}>{t('currentBalance')}</Text>
        <MaterialCommunityIcons color={theme.onPrimary} name="chevron-right" size={22} />
      </View>
      <View style={styles.balanceAmounts}>
        {state.balances.length ? state.balances.map((balance) => <MoneyTextInverted key={balance.currency} locale={locale} value={balance} />) : <Text style={[styles.noBalance, { color: theme.onPrimary }]}>{t('noBalanceData')}</Text>}
      </View>
    </Pressable>

    <View style={[styles.periodPicker, { borderBottomColor: theme.border }]}>
      {(['day', 'week', 'month', 'year'] as const).map((value) => {
        const active = period === value;
        return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={value} onPress={() => setPeriod(value)} style={[styles.periodOption, active && { borderBottomColor: theme.primary }]}>
          <Text style={[styles.periodText, { color: active ? theme.primary : theme.muted }]}>{t(periodKey[value])}</Text>
        </Pressable>;
      })}
    </View>

    <Text style={[styles.rangeLabel, { color: theme.muted }]}>{range.label(locale)}</Text>
    <View style={styles.summaryRow}>
      <SummaryMetric icon="arrow-up-right" label={t('expenses')} tone={theme.danger} value={{ amountMinor: expenseMinor, currency: baseCurrency }} />
      <SummaryMetric icon="arrow-down-left" label={t('income')} tone={theme.positive} value={{ amountMinor: incomeMinor, currency: baseCurrency }} />
    </View>

    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('spendingByCategory')}</Text>
      <Text style={[styles.sectionMeta, { color: theme.muted }]}>{baseCurrency}</Text>
    </View>
    {categoryRows.length ? <Card>{categoryRows.slice(0, 6).map((row, index) => <View key={row.id} style={[styles.categoryRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.categoryIcon, { backgroundColor: theme.background }]}><MaterialCommunityIcons color={theme.primary} name={(row.icon || 'shape-outline') as never} size={22} /></View>
      <View style={styles.categoryMain}>
        <View style={styles.categoryLabels}><Text numberOfLines={1} style={[styles.categoryName, { color: theme.text }]}>{row.name}</Text><Text style={[styles.categoryPercent, { color: theme.muted }]}>{row.percent}%</Text></View>
        <View style={[styles.track, { backgroundColor: theme.background }]}><View style={[styles.fill, { backgroundColor: theme.primary, width: `${row.percent}%` }]} /></View>
      </View>
      <MoneyText locale={locale} value={{ amountMinor: row.amountMinor, currency: baseCurrency }} />
    </View>)}</Card> : <Card><Text style={[styles.emptyText, { color: theme.muted }]}>{t('noSpendingInPeriod')}</Text></Card>}

    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('recent')}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/transactions' as Href)}><Text style={[styles.seeAll, { color: theme.primary }]}>{t('seeAll')}</Text></Pressable>
    </View>
    {recent.length ? recent.map((transaction) => <Pressable key={transaction.id} onPress={() => router.push(`/transaction/new?id=${transaction.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
      <View style={[styles.recentRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.recentIcon, { backgroundColor: theme.surface }]}><MaterialCommunityIcons color={theme.primary} name={transaction.transactionType === 'income' ? 'arrow-down-left' : 'arrow-up-right'} size={21} /></View>
        <View style={styles.recentMain}><Text numberOfLines={1} style={[styles.recentTitle, { color: theme.text }]}>{transaction.description || t(transaction.transactionType === 'income' ? 'income' : 'expense')}</Text><Text style={[styles.recentDate, { color: theme.muted }]}>{formatDate(transaction.transactionDate, locale)}</Text></View>
        <MoneyText locale={locale} tone={transaction.originalAmount.amountMinor < 0n ? 'danger' : 'positive'} value={transaction.originalAmount} />
      </View>
    </Pressable>) : <Card><Text style={[styles.emptyText, { color: theme.muted }]}>{t('noTransactionsHint')}</Text></Card>}
  </>;
}

function MoneyTextInverted({ locale, value }: { locale: 'en' | 'uk' | 'ru'; value: Money }) {
  const { moneyDisplay, theme } = useSettings();
  const formatted = formatMoney(value, locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : 'en-US', moneyDisplay);
  return <Text accessibilityLabel={formatted} style={[styles.balanceValue, { color: theme.onPrimary }]}>{formatted}</Text>;
}

function SummaryMetric({ icon, label, tone, value }: { icon: 'arrow-up-right' | 'arrow-down-left'; label: string; tone: string; value: Money }) {
  const { locale, theme } = useSettings();
  return <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.metricLabel}><MaterialCommunityIcons color={tone} name={icon} size={18} /><Text style={[styles.metricLabelText, { color: theme.muted }]}>{label}</Text></View><MoneyText locale={locale} value={value} variant="metric" /></View>;
}

function sumType(transactions: Transaction[], amounts: Record<string, Money>, type: 'expense' | 'income') {
  return transactions.filter((transaction) => transaction.transactionType === type).reduce((total, transaction) => total + abs(amounts[transaction.id]?.amountMinor ?? 0n), 0n);
}

function buildCategoryRows(transactions: Transaction[], amounts: Record<string, Money>, categories: Category[], locale: 'en' | 'uk' | 'ru') {
  const totals = new Map<string, bigint>();
  for (const transaction of transactions) if (transaction.transactionType === 'expense') {
    const key = transaction.categoryId ?? 'uncategorized';
    totals.set(key, (totals.get(key) ?? 0n) + abs(amounts[transaction.id]?.amountMinor ?? 0n));
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0n);
  return [...totals.entries()].map(([id, amountMinor]) => {
    const category = categories.find((candidate) => candidate.id === id);
    return { amountMinor, icon: category?.icon, id, name: category?.names[locale] ?? '—', percent: total ? Number((amountMinor * 100n) / total) : 0 };
  }).sort((a, b) => a.amountMinor > b.amountMinor ? -1 : a.amountMinor < b.amountMinor ? 1 : 0);
}

function abs(value: bigint) { return value < 0n ? -value : value; }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function getPeriodRange(period: Period) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (period === 'week') { const offset = (start.getDay() + 6) % 7; start.setDate(start.getDate() - offset); end.setDate(start.getDate() + 6); }
  if (period === 'month') { start.setDate(1); end.setMonth(start.getMonth() + 1, 0); }
  if (period === 'year') { start.setMonth(0, 1); end.setMonth(11, 31); }
  return { start: isoDate(start), end: isoDate(end), label: (locale: 'en' | 'uk' | 'ru') => period === 'day' ? formatDate(isoDate(start), locale) : `${formatDate(isoDate(start), locale)} — ${formatDate(isoDate(end), locale)}` };
}

const periodKey = { day: 'periodDay', week: 'periodWeek', month: 'periodMonth', year: 'periodYear' } as const;

const styles = StyleSheet.create({
  scopePicker: { borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', marginBottom: spacing.md, padding: spacing.xs },
  scopeOption: { alignItems: 'center', borderRadius: radii.pill, flex: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.sm },
  scopeText: { fontSize: fontSizes.label, fontWeight: fontWeights.bold },
  balanceCard: { borderRadius: radii.xl, minHeight: 132, padding: spacing.xl },
  balanceHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  balanceLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold, opacity: 0.82 },
  balanceAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg },
  balanceValue: { fontSize: 24, fontVariant: ['tabular-nums'], fontWeight: fontWeights.extraBold, letterSpacing: -0.5 },
  noBalance: { fontSize: fontSizes.body, opacity: 0.82 },
  periodPicker: { borderBottomWidth: 1, flexDirection: 'row', marginTop: spacing.xl },
  periodOption: { alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', flex: 1, minHeight: 44, justifyContent: 'center' },
  periodText: { fontSize: fontSizes.label, fontWeight: fontWeights.bold },
  rangeLabel: { fontSize: fontSizes.caption, marginTop: spacing.md, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  metric: { borderRadius: radii.lg, borderWidth: 1, flex: 1, gap: spacing.sm, padding: spacing.md },
  metricLabel: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  metricLabelText: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xxl },
  sectionTitle: { fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold },
  sectionMeta: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
  categoryRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  categoryIcon: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  categoryMain: { flex: 1, gap: spacing.sm },
  categoryLabels: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  categoryName: { flex: 1, fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  categoryPercent: { fontSize: fontSizes.caption },
  track: { borderRadius: radii.pill, height: 4, overflow: 'hidden' },
  fill: { borderRadius: radii.pill, height: 4 },
  emptyText: { fontSize: fontSizes.body, lineHeight: 22, textAlign: 'center' },
  seeAll: { fontSize: fontSizes.label, fontWeight: fontWeights.extraBold, minHeight: 44, paddingTop: spacing.md },
  recentRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, minHeight: 68 },
  recentIcon: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  recentMain: { flex: 1 },
  recentTitle: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  recentDate: { fontSize: fontSizes.caption, marginTop: spacing.xs },
});
