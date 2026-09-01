import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Account, Transaction } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { AppTextField, Card, EmptyState, ErrorState, LoadingState, MoneyText, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { formatDate } from '@/src/i18n/formatters';
import { useSettings } from '@/src/settings/settings-context';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; accounts: Account[]; memberId: string | null; transactions: Transaction[] };

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const { locale, t, theme } = useSettings();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      if (!household) {
        setState({ status: 'ready', accounts: [], memberId: null, transactions: [] });
        return;
      }
      const [accounts, member, transactions] = await Promise.all([
        repository.listAccounts(household.id), repository.getActiveMember(household.id), repository.listTransactions(household.id),
      ]);
      setState({ status: 'ready', accounts, memberId: member?.id ?? null, transactions });
    } catch {
      setState({ status: 'error' });
    }
  }, [repository]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleTransactions = state.status === 'ready' ? state.transactions.filter((transaction) => {
    if (typeFilter !== 'all' && transaction.transactionType !== typeFilter) return false;
    if (accountFilter !== 'all' && transaction.accountId !== accountFilter) return false;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return true;
    const accountName = state.accounts.find((account) => account.id === transaction.accountId)?.name ?? '';
    return `${transaction.description ?? ''} ${accountName}`.toLocaleLowerCase().includes(normalizedQuery);
  }) : [];

  return (
    <Screen>
      <ScreenHeader title={t('transactions')} action={
        <Pressable accessibilityLabel={t('addTransaction')} accessibilityRole="button" hitSlop={8} onPress={() => router.push('/transaction/new')} style={({ pressed }) => [styles.addButton, { backgroundColor: theme.primary, opacity: pressed ? 0.78 : 1 }]}>
          <MaterialCommunityIcons color={theme.onPrimary} name="plus" size={26} />
        </Pressable>
      } />
      {lastDeletedId && state.status === 'ready' && state.memberId ? <View style={[styles.undoBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.undoText, { color: theme.text }]}>{t('transactionDeleted')}</Text>
        <Pressable accessibilityRole="button" onPress={() => void repository.restoreTransaction(lastDeletedId, new Date().toISOString(), state.memberId!).then(() => { setLastDeletedId(null); return load(); }).catch(() => Alert.alert(t('transactionRestoreError')))}>
          <Text style={[styles.undoAction, { color: theme.primary }]}>{t('undo')}</Text>
        </Pressable>
      </View> : null}
      {state.status === 'ready' && state.transactions.length > 0 ? <>
        <AppTextField label={t('searchTransactions')} onChangeText={setQuery} value={query} />
        <FilterChoices label={t('transactionType')} options={[{ label: t('all'), value: 'all' }, { label: t('expense'), value: 'expense' }, { label: t('income'), value: 'income' }, { label: t('transfer'), value: 'transfer' }]} selected={typeFilter} onSelect={(value) => setTypeFilter(value as typeof typeFilter)} />
        <FilterChoices label={t('account')} options={[{ label: t('all'), value: 'all' }, ...state.accounts.map((account) => ({ label: account.name, value: account.id }))]} selected={accountFilter} onSelect={setAccountFilter} />
      </> : null}
      {state.status === 'loading' ? <LoadingState label={t('loadingTransactions')} /> : null}
      {state.status === 'error' ? <Card><ErrorState message={t('transactionsLoadError')} onRetry={() => void load()} retryLabel={t('retry')} /></Card> : null}
      {state.status === 'ready' && state.transactions.length === 0 ? <EmptyState
        description={t('noTransactionsHint')}
        icon={<MaterialCommunityIcons color={theme.primary} name="receipt-text-outline" size={46} />}
        title={t('noTransactions')}
      /> : null}
      {state.status === 'ready' && state.transactions.length > 0 && visibleTransactions.length === 0 ? <EmptyState description={t('noMatchingTransactionsHint')} icon={<MaterialCommunityIcons color={theme.primary} name="magnify" size={46} />} title={t('noMatchingTransactions')} /> : null}
      {state.status === 'ready' ? groupByDate(visibleTransactions).map(([date, transactions]) => <View key={date} style={styles.dateGroup}>
        <Text style={[styles.date, { color: theme.muted }]}>{formatDate(date, locale)}</Text>
        {transactions.map((transaction) => {
          const account = state.accounts.find((candidate) => candidate.id === transaction.accountId);
          const tone = transaction.originalAmount.amountMinor < 0n ? 'danger' : 'positive';
          const editable = transaction.transactionType === 'expense' || transaction.transactionType === 'income';
          return <Pressable disabled={!editable} key={transaction.id} onPress={() => router.push(`/transaction/new?id=${transaction.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
          <Card>
            <View style={styles.row}>
              <View style={styles.details}>
                <Text style={[styles.transactionTitle, { color: theme.text }]}>{transaction.description || t(transactionTypeKey[transaction.transactionType])}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>{account?.name ?? t('unknownAccount')}{transaction.status === 'fx_pending' ? ` · ${t('fxPending')}` : ''}</Text>
              </View>
              <MoneyText locale={locale} tone={tone} value={transaction.originalAmount} variant="metric" />
              {editable ? <Pressable accessibilityLabel={t('copyTransaction')} accessibilityRole="button" hitSlop={8} onPress={(event) => { event.stopPropagation(); router.push(`/transaction/new?copyId=${transaction.id}`); }} style={styles.iconButton}>
                <MaterialCommunityIcons color={theme.primary} name="content-copy" size={20} />
              </Pressable> : null}
              {state.memberId ? <Pressable accessibilityLabel={t('deleteTransaction')} accessibilityRole="button" hitSlop={8} onPress={(event) => { event.stopPropagation(); Alert.alert(t('deleteTransaction'), t('deleteTransactionConfirm'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('delete'), style: 'destructive', onPress: () => void repository.softDeleteTransaction(transaction.id, new Date().toISOString(), state.memberId!).then(() => { setLastDeletedId(transaction.id); return load(); }).catch(() => Alert.alert(t('transactionDeleteError'))) },
              ]); }} style={styles.deleteButton}>
                <MaterialCommunityIcons color={theme.danger} name="trash-can-outline" size={22} />
              </Pressable> : null}
            </View>
          </Card></Pressable>;
        })}
      </View>) : null}
    </Screen>
  );
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

const transactionTypeKey = {
  expense: 'expense', income: 'income', transfer: 'transfer', refund: 'refund',
  adjustment: 'adjustment', debt_payment: 'debtPayment',
} as const;

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  dateGroup: { gap: spacing.sm, marginBottom: spacing.xl },
  date: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold, marginTop: spacing.sm },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  details: { flex: 1 },
  transactionTitle: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold },
  meta: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  iconButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 36 },
  undoBar: { alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, padding: spacing.md },
  undoText: { fontSize: fontSizes.body },
  undoAction: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold, padding: spacing.sm },
  filterGroup: { gap: spacing.sm, marginBottom: spacing.lg },
  filterLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: { borderRadius: radii.lg, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  filterText: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
});
