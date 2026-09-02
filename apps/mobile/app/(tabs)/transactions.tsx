import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Account, Category, RecurringRule, Transaction } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { Card, EmptyState, ErrorState, LoadingState, MoneyText, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { formatDate } from '@/src/i18n/formatters';
import { deriveReportingAmounts } from '@/src/fx/reporting-amounts';
import { resolveCategoryColor, resolveCategoryForeground, resolveCategoryIcon } from '@/src/features/categories/category-appearance';
import { useSettings } from '@/src/settings/settings-context';
import { addDays, buildUpcomingItems } from '@/src/domain/recurring/schedule';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; accounts: Account[]; categories: Category[]; memberId: string | null; recurringRules: RecurringRule[]; transactions: Transaction[] };

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const { baseCurrency, locale, t, theme } = useSettings();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [typeFilter, setTypeFilter] = useState<'all' | Transaction['transactionType']>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | Transaction['source']>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [plannedOpen, setPlannedOpen] = useState(false);
  const [actionTransaction, setActionTransaction] = useState<Transaction | null>(null);
  const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);
  const [reportingAmounts, setReportingAmounts] = useState<Record<string, Transaction['originalAmount']>>({});

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      if (!household) {
        setState({ status: 'ready', accounts: [], categories: [], memberId: null, recurringRules: [], transactions: [] });
        return;
      }
      const [accounts, categories, member, transactions, recurringRules] = await Promise.all([
        repository.listAccounts(household.id), repository.listCategories(household.id), repository.getActiveMember(household.id), repository.listTransactions(household.id),
        repository.listRecurringRules(household.id),
      ]);
      setState({ status: 'ready', accounts, categories, memberId: member?.id ?? null, recurringRules, transactions });
      setReportingAmounts({});
      void deriveReportingAmounts(db, transactions, baseCurrency).then(setReportingAmounts).catch(() => undefined);
    } catch {
      setState({ status: 'error' });
    }
  }, [baseCurrency, db, repository]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleTransactions = state.status === 'ready' ? state.transactions.filter((transaction) => {
    if (typeFilter !== 'all' && transaction.transactionType !== typeFilter) return false;
    if (accountFilter !== 'all' && transaction.accountId !== accountFilter) return false;
    if (categoryFilter !== 'all' && transaction.categoryId !== categoryFilter) return false;
    if (currencyFilter !== 'all' && transaction.originalAmount.currency !== currencyFilter) return false;
    return sourceFilter === 'all' || transaction.source === sourceFilter;
  }) : [];

  const activeFilterCount = [typeFilter, accountFilter, categoryFilter, currencyFilter, sourceFilter].filter((value) => value !== 'all').length;
  const currencies = state.status === 'ready' ? [...new Set(state.transactions.map((transaction) => transaction.originalAmount.currency))] : [];
  const today = toIsoDate(new Date());
  const recurringTemplateIds = new Set(state.status === 'ready' ? state.recurringRules.map((rule) => rule.templateTransactionId) : []);
  const standalonePlanned = visibleTransactions.filter((transaction) => (transaction.status === 'planned' || transaction.transactionDate > today) && !recurringTemplateIds.has(transaction.id));
  const recurringPlanned = state.status === 'ready'
    ? buildUpcomingItems(state.recurringRules, visibleTransactions, today, addDays(today, 365), 500)
    : [];
  const plannedCount = standalonePlanned.length + recurringPlanned.length;
  const completedTransactions = visibleTransactions.filter((transaction) => transaction.status !== 'planned' && transaction.transactionDate <= today);

  function confirmDelete(transactionId: string, memberId: string) {
    Alert.alert(t('deleteTransaction'), t('deleteTransactionConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => void repository.softDeleteTransaction(transactionId, new Date().toISOString(), memberId).then(() => { setLastDeletedId(transactionId); return load(); }).catch(() => Alert.alert(t('transactionDeleteError'))) },
    ]);
  }

  function showTransactionActions(transaction: Transaction) {
    setActionTransaction(transaction);
  }

  return (
    <Screen>
      <ScreenHeader title={t('transactions')} action={<View style={styles.headerActions}>
        <Pressable accessibilityLabel={t('filters')} accessibilityRole="button" hitSlop={8} onPress={() => setFiltersOpen(true)} style={[styles.headerIconButton, { backgroundColor: theme.surface, borderColor: activeFilterCount ? theme.primary : theme.border }]}>
          <MaterialCommunityIcons color={theme.primary} name="filter-variant" size={23} />
          {activeFilterCount ? <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}><Text style={[styles.filterBadgeText, { color: theme.onPrimary }]}>{activeFilterCount}</Text></View> : null}
        </Pressable>
        <Pressable accessibilityLabel={t('addTransaction')} accessibilityRole="button" hitSlop={8} onPress={() => router.push('/transaction/new')} style={({ pressed }) => [styles.addButton, { backgroundColor: theme.primary, opacity: pressed ? 0.78 : 1 }]}>
          <MaterialCommunityIcons color={theme.onPrimary} name="plus" size={26} />
        </Pressable>
      </View>} />
      {lastDeletedId && state.status === 'ready' && state.memberId ? <View style={[styles.undoBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.undoText, { color: theme.text }]}>{t('transactionDeleted')}</Text>
        <Pressable accessibilityRole="button" onPress={() => void repository.restoreTransaction(lastDeletedId, new Date().toISOString(), state.memberId!).then(() => { setLastDeletedId(null); return load(); }).catch(() => Alert.alert(t('transactionRestoreError')))}>
          <Text style={[styles.undoAction, { color: theme.primary }]}>{t('undo')}</Text>
        </Pressable>
      </View> : null}
      {state.status === 'ready' && state.transactions.length > 0 ? <>
        <Text style={[styles.reportingCurrency, { color: theme.muted }]}>{t('reportingCurrency')}: {baseCurrency}</Text>
      </> : null}
      {state.status === 'ready' && plannedCount > 0 ? <View style={styles.plannedSection}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: plannedOpen }} onPress={() => setPlannedOpen((value) => !value)} style={[styles.plannedHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.plannedHeading}><MaterialCommunityIcons color={theme.warning} name="calendar-clock-outline" size={22} /><Text style={[styles.plannedTitle, { color: theme.text }]}>{t('plannedTransactions')}</Text><View style={[styles.plannedBadge, { backgroundColor: theme.warning }]}><Text style={[styles.plannedBadgeText, { color: theme.background }]}>{plannedCount}</Text></View></View>
          <MaterialCommunityIcons color={theme.muted} name={plannedOpen ? 'chevron-up' : 'chevron-down'} size={23} />
        </Pressable>
        {plannedOpen ? <View style={[styles.plannedList, { backgroundColor: theme.surface, borderColor: theme.border }]}>{[
          ...standalonePlanned.map((transaction) => ({ key: transaction.id, templateId: transaction.id, transaction, occurrenceDate: transaction.transactionDate })),
          ...recurringPlanned.map((item) => ({ key: `${item.rule.id}:${item.occurrenceDate}`, templateId: item.transaction.id, transaction: item.transaction, occurrenceDate: item.occurrenceDate })),
        ].sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate)).map((item) => {
          const { transaction } = item;
          const category = state.categories.find((candidate) => candidate.id === transaction.categoryId);
          return <Pressable key={item.key} onLongPress={() => showTransactionActions(transaction)} onPress={() => router.push(`/transaction/new?id=${item.templateId}`)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
            <View style={[styles.plannedRow, { borderBottomColor: theme.border }]}>
              <View style={styles.plannedDate}><Text style={[styles.plannedDay, { color: theme.warning }]}>{formatDate(item.occurrenceDate, locale)}</Text><Text numberOfLines={1} style={[styles.plannedName, { color: theme.text }]}>{transaction.description || category?.names[locale] || t(transactionTypeKey[transaction.transactionType])}</Text></View>
              <MoneyText locale={locale} value={{ ...transaction.originalAmount, amountMinor: transaction.originalAmount.amountMinor < 0n ? -transaction.originalAmount.amountMinor : transaction.originalAmount.amountMinor }} />
            </View>
          </Pressable>;
        })}</View> : null}
      </View> : null}
      {state.status === 'loading' ? <LoadingState label={t('loadingTransactions')} /> : null}
      {state.status === 'error' ? <Card><ErrorState message={t('transactionsLoadError')} onRetry={() => void load()} retryLabel={t('retry')} /></Card> : null}
      {state.status === 'ready' && state.transactions.length === 0 ? <EmptyState
        description={t('noTransactionsHint')}
        icon={<MaterialCommunityIcons color={theme.primary} name="receipt-text-outline" size={46} />}
        title={t('noTransactions')}
      /> : null}
      {state.status === 'ready' && state.transactions.length > 0 && completedTransactions.length === 0 && plannedCount === 0 ? <EmptyState description={t('noMatchingTransactionsHint')} icon={<MaterialCommunityIcons color={theme.primary} name="magnify" size={46} />} title={t('noMatchingTransactions')} /> : null}
      {state.status === 'ready' ? groupByDate(completedTransactions).map(([date, transactions]) => <View key={date} style={styles.dateGroup}>
        <View style={[styles.dateHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.date, { color: theme.muted }]}>{formatDateGroup(date, locale, t)}</Text>
          <MoneyText locale={locale} tone={getDailyTotal(transactions, reportingAmounts, baseCurrency) < 0n ? 'danger' : getDailyTotal(transactions, reportingAmounts, baseCurrency) > 0n ? 'positive' : 'default'} value={{ amountMinor: getDailyTotal(transactions, reportingAmounts, baseCurrency), currency: baseCurrency }} />
        </View>
        <View style={[styles.dayTransactions, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {transactions.map((transaction) => {
          const account = state.accounts.find((candidate) => candidate.id === transaction.accountId);
          const category = state.categories.find((candidate) => candidate.id === transaction.categoryId);
          const parentCategory = category?.parentId ? state.categories.find((candidate) => candidate.id === category.parentId) : null;
          const tone = transaction.originalAmount.amountMinor < 0n ? 'danger' : 'positive';
          const editable = transaction.transactionType === 'expense' || transaction.transactionType === 'income';
          const reportingAmount = reportingAmounts[transaction.id];
          return <Pressable key={transaction.id} onLongPress={() => showTransactionActions(transaction)} onPress={editable ? () => router.push(`/transaction/new?id=${transaction.id}`) : undefined} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
            <View style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={[styles.transactionIcon, { backgroundColor: resolveCategoryColor(theme, category?.colorToken ?? null) }]}><MaterialCommunityIcons color={resolveCategoryForeground(theme, category?.colorToken ?? null, category?.iconColor ?? null)} name={category ? resolveCategoryIcon(category.icon) : 'swap-horizontal'} size={24} /></View>
              <View style={styles.details}>
                <Text style={[styles.transactionTitle, { color: theme.text }]}>{category ? `${parentCategory ? `${parentCategory.names[locale]} › ` : ''}${category.names[locale]}` : t(transactionTypeKey[transaction.transactionType])}</Text>
                {transaction.description ? <Text style={[styles.description, { color: theme.muted }]}>{transaction.description}</Text> : null}
                <Text style={[styles.meta, { color: theme.muted }]}>{account?.name ?? t('unknownAccount')}{transaction.status === 'fx_pending' ? ` · ${t('fxPending')}` : ''}</Text>
              </View>
              <View style={styles.amounts}>
                <MoneyText locale={locale} tone={tone} value={transaction.originalAmount} variant="metric" />
                {reportingAmount && reportingAmount.currency !== transaction.originalAmount.currency ? <>
                  <Text style={[styles.convertedLabel, { color: theme.muted }]}>{t('convertedAmount')}</Text>
                  <MoneyText locale={locale} tone={tone} value={reportingAmount} />
                </> : null}
              </View>
            </View>
          </Pressable>;
        })}
        </View>
      </View>) : null}
      <Modal animationType="fade" onRequestClose={() => setFiltersOpen(false)} transparent visible={filtersOpen}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={() => setFiltersOpen(false)} style={[styles.modalBackdrop, { backgroundColor: `${theme.text}73` }]}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.modalSheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{t('filters')}</Text><Pressable accessibilityLabel={t('close')} accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={styles.closeButton}><MaterialCommunityIcons color={theme.text} name="close" size={25} /></Pressable></View>
            <ScrollView>
            <FilterChoices label={t('transactionType')} options={[{ label: t('all'), value: 'all' }, ...Object.entries(transactionTypeKey).map(([value, key]) => ({ label: t(key), value }))]} selected={typeFilter} onSelect={(value) => setTypeFilter(value as typeof typeFilter)} />
            <FilterChoices label={t('account')} options={[{ label: t('all'), value: 'all' }, ...(state.status === 'ready' ? state.accounts.map((account) => ({ label: account.name, value: account.id })) : [])]} selected={accountFilter} onSelect={setAccountFilter} />
            <FilterChoices label={t('category')} options={[{ label: t('all'), value: 'all' }, ...(state.status === 'ready' ? state.categories.map((category) => { const parent = category.parentId ? state.categories.find((candidate) => candidate.id === category.parentId) : null; return { label: `${parent ? `${parent.names[locale]} › ` : ''}${category.names[locale]}`, value: category.id }; }) : [])]} selected={categoryFilter} onSelect={setCategoryFilter} />
            <FilterChoices label={t('currency')} options={[{ label: t('all'), value: 'all' }, ...currencies.map((currency) => ({ label: currency, value: currency }))]} selected={currencyFilter} onSelect={setCurrencyFilter} />
            <FilterChoices label={t('transactionSource')} options={[{ label: t('all'), value: 'all' }, { label: t('sourceManual'), value: 'manual' }, { label: t('sourceImport'), value: 'import' }, { label: t('sourceRecurring'), value: 'recurring' }, { label: t('sourceBankApi'), value: 'bank_api' }]} selected={sourceFilter} onSelect={(value) => setSourceFilter(value as typeof sourceFilter)} />
            </ScrollView>
            <View style={styles.modalFooter}><Pressable accessibilityRole="button" onPress={() => { setTypeFilter('all'); setAccountFilter('all'); setCategoryFilter('all'); setCurrencyFilter('all'); setSourceFilter('all'); }} style={styles.resetButton}><Text style={[styles.resetText, { color: theme.primary }]}>{t('resetFilters')}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={[styles.doneButton, { backgroundColor: theme.primary }]}><Text style={[styles.doneText, { color: theme.onPrimary }]}>{t('done')}</Text></Pressable></View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal animationType="fade" onRequestClose={() => setActionTransaction(null)} transparent visible={actionTransaction !== null}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={() => setActionTransaction(null)} style={[styles.modalBackdrop, { backgroundColor: `${theme.text}73` }]}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.actionSheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{t('transactionActions')}</Text><Pressable accessibilityLabel={t('close')} accessibilityRole="button" onPress={() => setActionTransaction(null)} style={styles.closeButton}><MaterialCommunityIcons color={theme.text} name="close" size={25} /></Pressable></View>
            {actionTransaction && (actionTransaction.transactionType === 'expense' || actionTransaction.transactionType === 'income') ? <>
              <ActionButton icon="pencil-outline" label={t('editTransaction')} onPress={() => { const transaction = actionTransaction; setActionTransaction(null); router.push(`/transaction/new?id=${transaction.id}`); }} />
              <ActionButton icon="content-copy" label={t('copyTransaction')} onPress={() => { const transaction = actionTransaction; setActionTransaction(null); router.push(`/transaction/new?copyId=${transaction.id}`); }} />
            </> : null}
            {actionTransaction && state.status === 'ready' && state.memberId ? <ActionButton danger icon="trash-can-outline" label={t('deleteTransaction')} onPress={() => { const transaction = actionTransaction; setActionTransaction(null); confirmDelete(transaction.id, state.memberId!); }} /> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function ActionButton({ danger = false, icon, label, onPress }: { danger?: boolean; icon: 'pencil-outline' | 'content-copy' | 'trash-can-outline'; label: string; onPress: () => void }) {
  const { theme } = useSettings();
  const color = danger ? theme.danger : theme.text;
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.actionButton, { borderColor: theme.border }]}><MaterialCommunityIcons color={color} name={icon} size={23} /><Text style={[styles.actionLabel, { color }]}>{label}</Text></Pressable>;
}

function FilterChoices({ label, onSelect, options, selected }: { label: string; onSelect: (value: string) => void; options: { label: string; value: string }[]; selected: string }) {
  const { theme } = useSettings();
  return <View style={styles.filterGroup}><Text style={[styles.filterLabel, { color: theme.text }]}>{label}</Text><View style={styles.filters}>{options.map((option) => { const active = option.value === selected; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={option.value} onPress={() => onSelect(option.value)} style={[styles.filter, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }]}><Text style={[styles.filterText, { color: active ? theme.onPrimary : theme.text }]}>{option.label}</Text></Pressable>; })}</View></View>;
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) groups.set(transaction.transactionDate, [...(groups.get(transaction.transactionDate) ?? []), transaction]);
  return [...groups.entries()];
}

function getDailyTotal(transactions: Transaction[], reportingAmounts: Record<string, Transaction['originalAmount']>, baseCurrency: Transaction['originalAmount']['currency']) {
  return transactions.reduce((total, transaction) => {
    if (transaction.transactionType === 'transfer') return total;
    const amount = reportingAmounts[transaction.id] ?? (transaction.originalAmount.currency === baseCurrency ? transaction.originalAmount : null);
    return total + (amount?.amountMinor ?? 0n);
  }, 0n);
}

function formatDateGroup(date: string, locale: 'en' | 'uk' | 'ru', t: (key: 'today' | 'yesterday') => string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date === toIsoDate(today)) return t('today');
  if (date === toIsoDate(yesterday)) return t('yesterday');
  return formatDate(date, locale);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const transactionTypeKey = {
  expense: 'expense', income: 'income', transfer: 'transfer', refund: 'refund',
  adjustment: 'adjustment', debt_payment: 'debtPayment',
} as const;

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  headerActions: { flexDirection: 'row', gap: spacing.sm }, headerIconButton: { alignItems: 'center', borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, filterBadge: { alignItems: 'center', borderRadius: 9, height: 18, justifyContent: 'center', position: 'absolute', right: -3, top: -3, minWidth: 18 }, filterBadgeText: { fontSize: 10, fontWeight: fontWeights.extraBold },
  dateGroup: { marginBottom: spacing.xl },
  dateHeader: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 42 },
  date: { fontSize: fontSizes.caption, fontWeight: fontWeights.extraBold, letterSpacing: 1.4, textTransform: 'uppercase' },
  dayTransactions: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', minHeight: 76, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  details: { flex: 1 },
  transactionIcon: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  amounts: { alignItems: 'flex-end' },
  convertedLabel: { fontSize: fontSizes.label, marginTop: spacing.xs },
  reportingCurrency: { fontSize: fontSizes.caption, marginBottom: spacing.md },
  plannedSection: { marginBottom: spacing.xl },
  plannedHeader: { alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: spacing.md },
  plannedHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  plannedTitle: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold },
  plannedBadge: { alignItems: 'center', borderRadius: 11, justifyContent: 'center', minHeight: 22, minWidth: 22, paddingHorizontal: spacing.xs },
  plannedBadgeText: { fontSize: fontSizes.caption, fontWeight: fontWeights.extraBold },
  plannedList: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg, borderWidth: 1, borderTopWidth: 0, overflow: 'hidden' },
  plannedRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  plannedDate: { flex: 1 }, plannedDay: { fontSize: fontSizes.caption, fontWeight: fontWeights.extraBold }, plannedName: { fontSize: fontSizes.body, fontWeight: fontWeights.bold, marginTop: spacing.xs },
  transactionTitle: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold },
  description: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  meta: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  undoBar: { alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, padding: spacing.md },
  undoText: { fontSize: fontSizes.body },
  undoAction: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold, padding: spacing.sm },
  filterGroup: { gap: spacing.sm, marginBottom: spacing.lg },
  filterLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: { borderRadius: radii.lg, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  filterText: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' }, modalSheet: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, maxHeight: '88%', padding: spacing.xl }, actionSheet: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, padding: spacing.xl }, modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }, modalTitle: { fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold }, closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, modalFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }, resetButton: { justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md }, resetText: { fontSize: fontSizes.button, fontWeight: fontWeights.bold }, doneButton: { borderRadius: radii.lg, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.xl }, doneText: { fontSize: fontSizes.button, fontWeight: fontWeights.extraBold }, actionButton: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 56 }, actionLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
});
