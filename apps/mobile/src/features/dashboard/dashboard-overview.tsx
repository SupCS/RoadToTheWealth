import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Account, Category, RecurringRule, Transaction } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { Card, ErrorState, LoadingState, MoneyText } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { formatMoney, type Money } from '@/src/domain/money/money';
import { deriveReportingAmounts } from '@/src/fx/reporting-amounts';
import { resolveCategoryColor, resolveCategoryForeground, resolveCategoryIcon } from '@/src/features/categories/category-appearance';
import { formatDate } from '@/src/i18n/formatters';
import { addDays, buildUpcomingItems } from '@/src/domain/recurring/schedule';
import { useSettings } from '@/src/settings/settings-context';

type Period = 'day' | 'week' | 'month' | 'year';
type CategoryView = 'list' | 'bar' | 'donut' | 'treemap';
type ReadyState = {
  accounts: Account[];
  balances: Money[];
  categories: Category[];
  hasSharedAccounts: boolean;
  memberId: string | null;
  recurringRules: RecurringRule[];
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
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [categoryView, setCategoryView] = useState<CategoryView>('list');
  const [showPlanned, setShowPlanned] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      if (!household) {
        setState({ status: 'ready', accounts: [], balances: [], categories: [], hasSharedAccounts: false, memberId: null, recurringRules: [], transactions: [] });
        return;
      }
      const member = await repository.getActiveMember(household.id);
      const [accounts, categories, transactions, recurringRules] = await Promise.all([
        repository.listAccounts(household.id),
        repository.listCategories(household.id),
        repository.listTransactions(household.id),
        repository.listRecurringRules(household.id),
      ]);
      const hasSharedAccounts = accounts.some((account) => account.ownershipScope === 'shared' && !account.isArchived);
      const effectiveScope = financialScope === 'household' && hasSharedAccounts ? 'household' : 'personal';
      const balances = effectiveScope === 'household'
        ? await repository.getBalances({ kind: 'household', householdId: household.id })
        : member ? await repository.getBalances({ kind: 'personal', householdId: household.id, memberId: member.id }) : [];
      setState({ status: 'ready', accounts, balances, categories, hasSharedAccounts, memberId: member?.id ?? null, recurringRules, transactions });
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
  const today = todayLocal();
  const visible = state.transactions.filter((transaction) => accountIds.has(transaction.accountId)
    && transaction.transactionDate >= range.start && transaction.transactionDate <= range.end
    && transaction.transactionDate <= today && transaction.status !== 'planned');
  const expenseMinor = sumType(visible, reportingAmounts, 'expense');
  const incomeMinor = sumType(visible, reportingAmounts, 'income');
  const categoryRows = buildCategoryRows(visible, reportingAmounts, state.categories, locale, t('withoutSubcategory'));
  const recent = state.transactions.filter((transaction) => accountIds.has(transaction.accountId) && transaction.status !== 'planned' && transaction.transactionDate <= today).slice(0, 3);
  const upcomingThrough = addDays(today, 30);
  const recurringTemplateIds = new Set(state.recurringRules.map((rule) => rule.templateTransactionId));
  const upcoming = [
    ...buildUpcomingItems(state.recurringRules, state.transactions.filter((transaction) => accountIds.has(transaction.accountId)), today, upcomingThrough)
      .map((item) => ({ key: `${item.rule.id}:${item.occurrenceDate}`, transaction: item.transaction, occurrenceDate: item.occurrenceDate })),
    ...state.transactions.filter((transaction) => accountIds.has(transaction.accountId)
      && !recurringTemplateIds.has(transaction.id)
      && (transaction.status === 'planned' || transaction.transactionDate > today)
      && transaction.transactionDate > today && transaction.transactionDate <= upcomingThrough)
      .map((transaction) => ({ key: transaction.id, transaction, occurrenceDate: transaction.transactionDate })),
  ].sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
  const plannedChartItems = showPlanned && range.end > today ? [
    ...buildUpcomingItems(state.recurringRules, state.transactions.filter((transaction) => accountIds.has(transaction.accountId)), today, range.end)
      .filter((item) => item.occurrenceDate >= range.start)
      .map((item) => ({ key: `${item.rule.id}:${item.occurrenceDate}`, transaction: item.transaction, occurrenceDate: item.occurrenceDate })),
    ...state.transactions.filter((transaction) => accountIds.has(transaction.accountId) && !recurringTemplateIds.has(transaction.id)
      && (transaction.status === 'planned' || transaction.transactionDate > today)
      && transaction.transactionDate >= range.start && transaction.transactionDate <= range.end)
      .map((transaction) => ({ key: transaction.id, transaction, occurrenceDate: transaction.transactionDate })),
  ] : [];
  const plannedChartTransactions = plannedChartItems.map((item) => ({ ...item.transaction, id: item.key, transactionDate: item.occurrenceDate }));
  const plannedChartAmounts = Object.fromEntries(plannedChartItems.flatMap((item) => {
    const amount = reportingAmounts[item.transaction.id] ?? (item.transaction.originalAmount.currency === baseCurrency ? item.transaction.originalAmount : null);
    return amount ? [[item.key, amount]] : [];
  }));
  const plannedCategoryRows = buildCategoryRows(plannedChartTransactions, plannedChartAmounts, state.categories, locale, t('withoutSubcategory'));
  const displayedCategoryRows = showPlanned ? mergeCategoryRows(categoryRows, plannedCategoryRows) : categoryRows;

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
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: showPlanned }} onPress={() => setShowPlanned((value) => !value)} style={[styles.plannedToggle, { backgroundColor: showPlanned ? theme.warning : theme.surface, borderColor: showPlanned ? theme.warning : theme.border }]}>
        <MaterialCommunityIcons color={showPlanned ? theme.background : theme.muted} name="calendar-clock-outline" size={17} /><Text style={[styles.plannedToggleText, { color: showPlanned ? theme.background : theme.muted }]}>{t('showPlanned')}</Text>
      </Pressable>
      <View accessibilityRole="radiogroup" style={[styles.categoryViewPicker, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {categoryViewOptions.map((option) => { const active = categoryView === option.value; return <Pressable accessibilityLabel={t(option.label)} accessibilityRole="radio" accessibilityState={{ checked: active }} key={option.value} onPress={() => setCategoryView(option.value)} style={[styles.categoryViewOption, active && { backgroundColor: theme.primary }]}>
          <MaterialCommunityIcons color={active ? theme.onPrimary : theme.muted} name={option.icon} size={17} />
        </Pressable>; })}
      </View>
    </View>
    {displayedCategoryRows.length ? <CategoryVisualization baseCurrency={baseCurrency} expandedCategoryIds={expandedCategoryIds} locale={locale} rows={displayedCategoryRows.slice(0, 6)} setExpandedCategoryIds={setExpandedCategoryIds} view={categoryView} /> : <Card><Text style={[styles.emptyText, { color: theme.muted }]}>{t('noSpendingInPeriod')}</Text></Card>}

    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('recent')}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/transactions' as Href)}><Text style={[styles.seeAll, { color: theme.primary }]}>{t('seeAll')}</Text></Pressable>
    </View>
    {recent.length ? recent.map((transaction) => { const category = state.categories.find((candidate) => candidate.id === transaction.categoryId); return <Pressable key={transaction.id} onPress={() => router.push(`/transaction/new?id=${transaction.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
      <View style={[styles.recentRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.recentAccent, { backgroundColor: resolveCategoryColor(theme, category?.colorToken ?? null) }]} />
        <View style={styles.recentMain}><Text numberOfLines={1} style={[styles.recentTitle, { color: theme.text }]}>{transaction.description || t(transaction.transactionType === 'income' ? 'income' : 'expense')}</Text><Text style={[styles.recentDate, { color: theme.muted }]}>{formatDate(transaction.transactionDate, locale)}</Text></View>
        <MoneyText locale={locale} tone={transaction.originalAmount.amountMinor < 0n ? 'danger' : 'positive'} value={transaction.originalAmount} />
      </View>
    </Pressable>; }) : <Card><Text style={[styles.emptyText, { color: theme.muted }]}>{t('noTransactionsHint')}</Text></Card>}

    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, styles.upcomingTitle, { color: theme.muted }]}>{t('comingUp').toUpperCase()}</Text>
    </View>
    <Card>
      {upcoming.length ? upcoming.map((item, index) => {
        const category = state.categories.find((candidate) => candidate.id === item.transaction.categoryId);
        const title = item.transaction.description || category?.names[locale] || t(item.transaction.transactionType === 'income' ? 'income' : 'expense');
        return <Pressable accessibilityRole="button" key={item.key} onPress={() => router.push(`/transaction/new?id=${item.transaction.id}`)}>
          <View style={[styles.upcomingRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: 1 }]}>
            <Text style={[styles.upcomingDate, { color: theme.warning }]}>{compactDate(item.occurrenceDate, locale)}</Text>
            <Text numberOfLines={1} style={[styles.upcomingName, { color: theme.text }]}>{title}</Text>
            <MoneyText locale={locale} value={{ ...item.transaction.originalAmount, amountMinor: item.transaction.originalAmount.amountMinor < 0n ? -item.transaction.originalAmount.amountMinor : item.transaction.originalAmount.amountMinor }} />
          </View>
        </Pressable>;
      }) : <Text style={[styles.emptyText, { color: theme.muted }]}>{t('noUpcomingPayments')}</Text>}
    </Card>
  </>;
}

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function compactDate(date: string, locale: 'en' | 'uk' | 'ru'): string {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)).toUpperCase();
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

type CategoryRow = { amountMinor: bigint; plannedMinor: bigint; children: CategoryRow[]; colorToken: string | null; icon: string | null; iconColor: string | null; id: string; name: string; percent: number };

function CategoryVisualization({ baseCurrency, expandedCategoryIds, locale, rows, setExpandedCategoryIds, view }: { baseCurrency: Money['currency']; expandedCategoryIds: Set<string>; locale: 'en' | 'uk' | 'ru'; rows: CategoryRow[]; setExpandedCategoryIds: (update: (current: Set<string>) => Set<string>) => void; view: CategoryView }) {
  if (view === 'list') return <Card>{rows.map((row, index) => { const expanded = expandedCategoryIds.has(row.id); return <Fragment key={row.id}>
    <CategorySpendingRow baseCurrency={baseCurrency} expanded={expanded} first={index === 0} locale={locale} onPress={row.children.length ? () => setExpandedCategoryIds((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; }) : undefined} row={row} />
    {expanded ? row.children.map((child) => <CategorySpendingRow baseCurrency={baseCurrency} child key={child.id} locale={locale} row={child} />) : null}
  </Fragment>; })}</Card>;
  if (view === 'treemap') return <CategoryTreemap rows={rows} />;
  return <Card>
    {view === 'bar' ? <CategoryBar rows={rows} /> : <CategoryDonut baseCurrency={baseCurrency} locale={locale} rows={rows} />}
    <CategoryLegend baseCurrency={baseCurrency} locale={locale} rows={rows} />
  </Card>;
}

function CategoryBar({ rows }: { rows: CategoryRow[] }) {
  const { t, theme } = useSettings();
  const totalPercent = rows.reduce((total, row) => total + row.percent, 0) || 1;
  return <View accessibilityLabel={t('categoryViewBar')} accessibilityRole="image" style={[styles.categoryBar, { backgroundColor: theme.background }]}>{rows.map((row) => { const total = row.amountMinor + row.plannedMinor; const color = resolveCategoryColor(theme, row.colorToken); return <View key={row.id} style={{ flex: row.percent / totalPercent, flexDirection: 'row' }}><View style={{ backgroundColor: color, flex: Number(row.amountMinor) / Number(total || 1n) }} />{row.plannedMinor ? <View style={{ backgroundColor: color, borderColor: theme.text, borderStyle: 'dashed', borderWidth: 1, flex: Number(row.plannedMinor) / Number(total), opacity: 0.38 }} /> : null}</View>; })}</View>;
}

function CategoryDonut({ baseCurrency, locale, rows }: { baseCurrency: Money['currency']; locale: 'en' | 'uk' | 'ru'; rows: CategoryRow[] }) {
  const { t, theme } = useSettings();
  const size = 208;
  const strokeWidth = 38;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0n);
  let offset = 0;
  return <View accessibilityLabel={t('categoryViewDonut')} accessibilityRole="image" style={styles.donutWrap}>
    <Svg height={size} width={size}>
      <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke={theme.background} strokeWidth={strokeWidth} />
      {rows.flatMap((row) => { const combined = row.amountMinor + row.plannedMinor; const fullLength = circumference * (row.percent / 100); const actualLength = combined ? fullLength * Number(row.amountMinor) / Number(combined) : 0; const plannedLength = fullLength - actualLength; const color = resolveCategoryColor(theme, row.colorToken); const actualOffset = -offset; const plannedOffset = -(offset + actualLength); offset += fullLength; return [
        actualLength ? <Circle cx={size / 2} cy={size / 2} fill="none" key={`${row.id}:actual`} r={radius} rotation={-90} origin={`${size / 2}, ${size / 2}`} stroke={color} strokeDasharray={`${actualLength} ${circumference - actualLength}`} strokeDashoffset={actualOffset} strokeWidth={strokeWidth} /> : null,
        plannedLength ? <Circle cx={size / 2} cy={size / 2} fill="none" key={`${row.id}:planned`} opacity={0.35} r={radius} rotation={-90} origin={`${size / 2}, ${size / 2}`} stroke={color} strokeDasharray={`${plannedLength} ${circumference - plannedLength}`} strokeDashoffset={plannedOffset} strokeWidth={strokeWidth} /> : null,
      ]; })}
    </Svg>
    <View pointerEvents="none" style={styles.donutCenter}>
      <Text style={[styles.donutLabel, { color: theme.muted }]}>{t('spent')}</Text>
      <MoneyText locale={locale} value={{ amountMinor: total, currency: baseCurrency }} variant="metric" />
      <Text style={[styles.donutMeta, { color: theme.muted }]}>{rows.length} {t('categoriesCount')}</Text>
    </View>
  </View>;
}

function CategoryLegend({ baseCurrency, locale, rows }: { baseCurrency: Money['currency']; locale: 'en' | 'uk' | 'ru'; rows: CategoryRow[] }) {
  const { theme } = useSettings();
  return <View style={styles.categoryLegend}>{rows.map((row) => <View key={row.id} style={[styles.legendItem, { borderTopColor: theme.border }]}>
    <View style={styles.legendHeading}><View style={[styles.legendDot, { backgroundColor: resolveCategoryColor(theme, row.colorToken) }]} /><Text numberOfLines={1} style={[styles.legendName, { color: theme.text }]}>{row.name}</Text></View>
    <View style={styles.legendValue}><MoneyText locale={locale} value={{ amountMinor: row.amountMinor, currency: baseCurrency }} />{row.plannedMinor ? <Text style={[styles.legendPercent, { color: theme.warning }]}>+ {formatMoney({ amountMinor: row.plannedMinor, currency: baseCurrency }, locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : 'en-US')}</Text> : null}<Text style={[styles.legendPercent, { color: theme.muted }]}>{row.percent}%</Text></View>
  </View>)}</View>;
}

function CategoryTreemap({ rows }: { rows: CategoryRow[] }) {
  const { t, theme } = useSettings();
  const bands = [rows.slice(0, 1), rows.slice(1, 3), rows.slice(3, 6)].filter((band) => band.length);
  return <View accessibilityLabel={t('categoryViewTreemap')} accessibilityRole="image" style={[styles.treemap, { backgroundColor: theme.background }]}>{bands.map((band, bandIndex) => <View key={bandIndex} style={[styles.treemapBand, { flex: band.reduce((sum, row) => sum + row.percent, 0) }]}>{band.map((row) => { const color = resolveCategoryColor(theme, row.colorToken); const combined = row.amountMinor + row.plannedMinor; return <View key={row.id} style={[styles.treemapTile, { backgroundColor: color, borderColor: theme.background, flex: row.percent }]}>
    {row.plannedMinor ? <View pointerEvents="none" style={[styles.treemapPlanned, { backgroundColor: theme.surface, width: `${Number(row.plannedMinor * 100n / (combined || 1n))}%` }]} /> : null}
    <Text numberOfLines={2} style={[styles.treemapName, { color: resolveCategoryForeground(theme, row.colorToken, null) }]}>{row.name}</Text>
    <Text style={[styles.treemapPercent, { color: resolveCategoryForeground(theme, row.colorToken, null) }]}>{row.percent}%</Text>
  </View>; })}</View>)}</View>;
}

function CategorySpendingRow({ baseCurrency, child = false, expanded = false, first = false, locale, onPress, row }: { baseCurrency: Money['currency']; child?: boolean; expanded?: boolean; first?: boolean; locale: 'en' | 'uk' | 'ru'; onPress?: () => void; row: CategoryRow }) {
  const { theme } = useSettings();
  const color = resolveCategoryColor(theme, row.colorToken);
  const combined = row.amountMinor + row.plannedMinor;
  const actualPercent = combined ? row.percent * Number(row.amountMinor) / Number(combined) : 0;
  const plannedPercent = row.percent - actualPercent;
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { expanded } : undefined} disabled={!onPress} onPress={onPress} style={[styles.categoryRow, child && styles.childCategoryRow, !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
    <View style={[styles.categoryIcon, child && styles.childCategoryIcon, { backgroundColor: color }]}><MaterialCommunityIcons color={resolveCategoryForeground(theme, row.colorToken, row.iconColor)} name={resolveCategoryIcon(row.icon)} size={child ? 18 : 22} /></View>
    <View style={styles.categoryMain}><View style={styles.categoryLabels}><Text numberOfLines={1} style={[styles.categoryName, child && styles.childCategoryName, { color: theme.text }]}>{row.name}</Text><Text style={[styles.categoryPercent, { color: theme.muted }]}>{row.percent}%</Text></View><View style={[styles.track, { backgroundColor: theme.background }]}><View style={[styles.fill, { backgroundColor: color, width: `${actualPercent}%` }]} />{row.plannedMinor ? <View style={[styles.plannedTrackFill, { backgroundColor: color, width: `${plannedPercent}%` }]} /> : null}</View></View>
    <View style={styles.categoryAmounts}><MoneyText locale={locale} value={{ amountMinor: row.amountMinor, currency: baseCurrency }} />{row.plannedMinor ? <Text style={[styles.categoryPlannedAmount, { color: theme.warning }]}>+ {formatMoney({ amountMinor: row.plannedMinor, currency: baseCurrency }, locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : 'en-US')}</Text> : null}</View>
    {onPress ? <MaterialCommunityIcons color={theme.muted} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} /> : null}
  </Pressable>;
}

function sumType(transactions: Transaction[], amounts: Record<string, Money>, type: 'expense' | 'income') {
  return transactions.filter((transaction) => transaction.transactionType === type).reduce((total, transaction) => total + abs(amounts[transaction.id]?.amountMinor ?? 0n), 0n);
}

function buildCategoryRows(transactions: Transaction[], amounts: Record<string, Money>, categories: Category[], locale: 'en' | 'uk' | 'ru', withoutSubcategory: string): CategoryRow[] {
  const totals = new Map<string, bigint>();
  for (const transaction of transactions) if (transaction.transactionType === 'expense') {
    const key = transaction.categoryId ?? 'uncategorized';
    totals.set(key, (totals.get(key) ?? 0n) + abs(amounts[transaction.id]?.amountMinor ?? 0n));
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0n);
  const roots = new Map<string, { amountMinor: bigint; breakdown: Map<string, bigint> }>();
  for (const [id, amountMinor] of totals) {
    const category = categories.find((candidate) => candidate.id === id);
    const rootId = category?.parentId ?? id;
    const root = roots.get(rootId) ?? { amountMinor: 0n, breakdown: new Map<string, bigint>() };
    root.amountMinor += amountMinor;
    root.breakdown.set(id, (root.breakdown.get(id) ?? 0n) + amountMinor);
    roots.set(rootId, root);
  }
  return [...roots.entries()].map(([id, root]) => {
    const category = categories.find((candidate) => candidate.id === id);
    const hasSubcategories = categories.some((candidate) => candidate.parentId === id);
    const children: CategoryRow[] = hasSubcategories ? [...root.breakdown.entries()].map(([childId, amountMinor]) => {
      const child = categories.find((candidate) => candidate.id === childId);
      return { amountMinor, plannedMinor: 0n, children: [], colorToken: child?.colorToken ?? category?.colorToken ?? null, icon: child?.icon ?? category?.icon ?? null, iconColor: child?.iconColor ?? category?.iconColor ?? null, id: `${id}:${childId}`, name: childId === id ? withoutSubcategory : child?.names[locale] ?? '—', percent: total ? Number((amountMinor * 100n) / total) : 0 };
    }).sort(compareCategoryRows) : [];
    return { amountMinor: root.amountMinor, plannedMinor: 0n, children, colorToken: category?.colorToken ?? null, icon: category?.icon ?? null, iconColor: category?.iconColor ?? null, id, name: category?.names[locale] ?? '—', percent: total ? Number((root.amountMinor * 100n) / total) : 0 };
  }).sort(compareCategoryRows);
}

function mergeCategoryRows(actualRows: CategoryRow[], plannedRows: CategoryRow[]): CategoryRow[] {
  const ids = new Set([...actualRows.map((row) => row.id), ...plannedRows.map((row) => row.id)]);
  const merged = [...ids].map((id) => {
    const actual = actualRows.find((row) => row.id === id);
    const planned = plannedRows.find((row) => row.id === id);
    const source = actual ?? planned!;
    return { ...source, amountMinor: actual?.amountMinor ?? 0n, plannedMinor: planned?.amountMinor ?? 0n, children: mergeCategoryRows(actual?.children ?? [], planned?.children ?? []) };
  });
  const total = merged.reduce((sum, row) => sum + row.amountMinor + row.plannedMinor, 0n);
  return merged.map((row) => ({ ...row, percent: total ? Number(((row.amountMinor + row.plannedMinor) * 100n) / total) : 0 }))
    .sort((a, b) => compareCategoryRows({ ...a, amountMinor: a.amountMinor + a.plannedMinor }, { ...b, amountMinor: b.amountMinor + b.plannedMinor }));
}

function compareCategoryRows(first: CategoryRow, second: CategoryRow) { return first.amountMinor > second.amountMinor ? -1 : first.amountMinor < second.amountMinor ? 1 : 0; }

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
const categoryViewOptions = [
  { icon: 'format-list-bulleted', label: 'categoryViewList', value: 'list' },
  { icon: 'chart-bar-stacked', label: 'categoryViewBar', value: 'bar' },
  { icon: 'chart-donut', label: 'categoryViewDonut', value: 'donut' },
  { icon: 'view-grid-outline', label: 'categoryViewTreemap', value: 'treemap' },
] as const;

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
  sectionTitle: { flex: 1, fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold },
  plannedToggle: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 34, paddingHorizontal: spacing.sm }, plannedToggleText: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
  upcomingTitle: { fontSize: fontSizes.caption, letterSpacing: 3 },
  upcomingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 58 },
  upcomingDate: { fontSize: fontSizes.caption, fontWeight: fontWeights.extraBold, minWidth: 58 },
  upcomingName: { flex: 1, fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  categoryViewPicker: { borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', padding: spacing.xxs },
  categoryViewOption: { alignItems: 'center', borderRadius: radii.pill, height: 34, justifyContent: 'center', width: 34 },
  plannedOverlay: { borderRadius: radii.lg, borderStyle: 'dashed', borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  plannedOverlayHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }, plannedOverlayTitle: { fontSize: fontSizes.label, fontWeight: fontWeights.extraBold },
  plannedChartRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }, plannedChartMain: { flex: 1 }, plannedChartName: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold, marginBottom: spacing.xs },
  plannedTrack: { borderRadius: radii.pill, borderStyle: 'dashed', borderWidth: 1, height: 8, overflow: 'hidden' }, plannedFill: { height: '100%', opacity: 0.48 },
  categoryBar: { borderRadius: radii.sm, flexDirection: 'row', height: 44, marginBottom: spacing.lg, overflow: 'hidden' },
  categoryLegend: { flexDirection: 'row', flexWrap: 'wrap' },
  legendItem: { borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingVertical: spacing.md, width: '50%' },
  legendHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.sm },
  legendDot: { borderRadius: 2, height: 8, width: 8 },
  legendName: { flex: 1, fontSize: fontSizes.label, fontWeight: fontWeights.bold },
  legendValue: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingLeft: spacing.lg },
  legendPercent: { fontSize: fontSizes.caption },
  donutWrap: { alignItems: 'center', alignSelf: 'center', height: 208, justifyContent: 'center', marginBottom: spacing.lg, width: 208 },
  donutCenter: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  donutLabel: { fontSize: fontSizes.caption, fontWeight: fontWeights.extraBold, letterSpacing: 1.5, textTransform: 'uppercase' },
  donutMeta: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  treemap: { borderRadius: radii.lg, height: 280, overflow: 'hidden' },
  treemapBand: { flexDirection: 'row' },
  treemapTile: { borderWidth: 2, minWidth: 68, padding: spacing.md },
  treemapPlanned: { bottom: 0, opacity: 0.42, position: 'absolute', right: 0, top: 0 },
  treemapName: { fontSize: fontSizes.label, fontWeight: fontWeights.extraBold },
  treemapPercent: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  categoryRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  childCategoryRow: { marginLeft: spacing.xl, minHeight: 54 },
  categoryIcon: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  childCategoryIcon: { borderRadius: 16, height: 32, width: 32 },
  categoryMain: { flex: 1, gap: spacing.sm },
  categoryAmounts: { alignItems: 'flex-end' }, categoryPlannedAmount: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold, marginTop: spacing.xs },
  categoryLabels: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  categoryName: { flex: 1, fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  childCategoryName: { fontSize: fontSizes.caption },
  categoryPercent: { fontSize: fontSizes.caption },
  track: { borderRadius: radii.pill, flexDirection: 'row', height: 4, overflow: 'hidden' },
  fill: { borderRadius: radii.pill, height: 4 },
  plannedTrackFill: { borderRadius: radii.pill, borderStyle: 'dashed', height: 4, opacity: 0.38 },
  emptyText: { fontSize: fontSizes.body, lineHeight: 22, textAlign: 'center' },
  seeAll: { fontSize: fontSizes.label, fontWeight: fontWeights.extraBold, minHeight: 44, paddingTop: spacing.md },
  recentRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, minHeight: 68 },
  recentAccent: { borderRadius: 2, height: 42, width: 4 },
  recentMain: { flex: 1 },
  recentTitle: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  recentDate: { fontSize: fontSizes.caption, marginTop: spacing.xs },
});
