import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Crypto from 'expo-crypto';
import { type Href, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Account, Category, Transaction } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { AppTextField, ErrorState, LoadingState, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { money, parseMajorAmount } from '@/src/domain/money/money';
import type { MoneyCurrencyCode } from '@/src/domain/money/currencies';
import { useSettings } from '@/src/settings/settings-context';

type EntryType = Extract<Transaction['transactionType'], 'expense' | 'income' | 'transfer'>;

export default function NewTransactionScreen() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const router = useRouter();
  const { locale, t, theme } = useSettings();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<EntryType>('expense');
  const [accountId, setAccountId] = useState('');
  const [transactionCurrency, setTransactionCurrency] = useState<MoneyCurrencyCode | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [validationError, setValidationError] = useState<string | null>(null);

  async function load() {
    setStatus('loading');
    try {
      const household = await repository.getActiveHousehold();
      if (!household) throw new Error('Household missing');
      const [member, allAccounts, allCategories] = await Promise.all([
        repository.getActiveMember(household.id), repository.listAccounts(household.id), repository.listCategories(household.id),
      ]);
      if (!member) throw new Error('Member missing');
      const activeAccounts = allAccounts.filter((account) => !account.isArchived);
      setHouseholdId(household.id);
      setBaseCurrency(household.baseCurrency);
      setMemberId(member.id);
      setAccounts(activeAccounts);
      setCategories(allCategories.filter((category) => !category.isArchived));
      setAccountId((current) => activeAccounts.some((account) => account.id === current) ? current : activeAccounts[0]?.id ?? '');
      setTransactionCurrency((current) => current ?? activeAccounts[0]?.openingBalances[0]?.currency ?? null);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { void load(); }, [repository]);
  const applicableCategories = categories.filter((category) => category.applicability === type || category.applicability === 'both');
  const sourceAccount = accounts.find((account) => account.id === accountId);
  const destinationAccounts = accounts.filter((account) => account.id !== accountId && account.openingBalances.some((balance) => balance.currency === transactionCurrency));

  function changeType(nextType: EntryType) {
    setType(nextType);
    const selected = categories.find((category) => category.id === categoryId);
    if (selected && selected.applicability !== nextType && selected.applicability !== 'both') setCategoryId('');
    if (nextType !== 'transfer') setDestinationAccountId('');
  }

  async function save() {
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account || !householdId || !memberId || !baseCurrency) {
      setValidationError(t('transactionContextError'));
      return;
    }
    let enteredAmount;
    try {
      if (!transactionCurrency || !account.openingBalances.some((balance) => balance.currency === transactionCurrency)) throw new Error('Currency missing');
      enteredAmount = parseMajorAmount(amount, transactionCurrency);
      if (enteredAmount.amountMinor <= 0n) throw new Error('Amount must be positive');
    } catch {
      setValidationError(t('positiveAmountRequired'));
      return;
    }
    if (!isDateOnly(date)) {
      setValidationError(t('invalidDate'));
      return;
    }
    setValidationError(null);
    setStatus('saving');
    const now = new Date().toISOString();
    const signedAmount = money(type === 'expense' ? -enteredAmount.amountMinor : enteredAmount.amountMinor, enteredAmount.currency);
    const isBaseCurrency = signedAmount.currency === baseCurrency;
    try {
      if (type === 'transfer') {
        const destination = destinationAccounts.find((candidate) => candidate.id === destinationAccountId);
        if (!destination) {
          setStatus('ready');
          setValidationError(t('destinationAccountRequired'));
          return;
        }
        const debitId = Crypto.randomUUID();
        const creditId = Crypto.randomUUID();
        const common = {
          householdId, memberId, categoryId: null, transactionType: 'transfer' as const,
          transactionDate: date, postingDate: null, source: 'manual' as const, status: 'confirmed' as const,
          reportingAmount: null, fxSnapshot: null, description: description.trim() || null, notes: null,
          createdAt: now, updatedAt: now, createdByMemberId: memberId, updatedByMemberId: memberId,
          revision: 1, deletedAt: null,
        };
        await repository.saveTransfer(
          { ...common, id: debitId, accountId: account.id, originalAmount: money(-enteredAmount.amountMinor, enteredAmount.currency) },
          { ...common, id: creditId, accountId: destination.id, originalAmount: enteredAmount },
          { id: Crypto.randomUUID(), householdId, debitTransactionId: debitId, creditTransactionId: creditId,
            sentAmount: enteredAmount, receivedAmount: enteredAmount, createdAt: now, updatedAt: now,
            createdByMemberId: memberId, updatedByMemberId: memberId, revision: 1, deletedAt: null },
        );
        router.replace('/transactions' as Href);
        return;
      }
      await repository.saveTransaction({
        id: Crypto.randomUUID(), householdId, accountId: account.id, memberId, categoryId: categoryId || null,
        transactionType: type, transactionDate: date, postingDate: null, source: 'manual',
        status: isBaseCurrency ? 'confirmed' : 'fx_pending', originalAmount: signedAmount,
        reportingAmount: isBaseCurrency ? signedAmount : null, fxSnapshot: null,
        description: description.trim() || null, notes: null, createdAt: now, updatedAt: now,
        createdByMemberId: memberId, updatedByMemberId: memberId, revision: 1, deletedAt: null,
      }, []);
      router.replace('/transactions' as Href);
    } catch {
      setStatus('ready');
      setValidationError(t('transactionSaveError'));
    }
  }

  if (status === 'loading') return <Screen><LoadingState label={t('loading')} /></Screen>;
  if (status === 'error') return <Screen><ErrorState message={t('transactionContextError')} onRetry={() => void load()} retryLabel={t('retry')} /></Screen>;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <MaterialCommunityIcons color={theme.primary} name="arrow-left" size={24} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>{t('back')}</Text>
      </Pressable>
      <ScreenHeader title={t('addTransaction')} />
      <ChoiceGroup label={t('transactionType')} options={[{ label: t('expense'), value: 'expense' }, { label: t('income'), value: 'income' }, { label: t('transfer'), value: 'transfer' }]} selected={type} onSelect={(value) => changeType(value as EntryType)} />
      {accounts.length === 0 ? <ErrorState message={t('noActiveAccountsForTransaction')} /> : <>
        <AppTextField error={validationError ?? undefined} keyboardType="decimal-pad" label={t('amount')} onChangeText={setAmount} placeholder="0.00" value={amount} />
        <ChoiceGroup label={t('account')} options={accounts.map((account) => ({ label: account.name, value: account.id }))} selected={accountId} onSelect={(value) => {
          setAccountId(value);
          const nextAccount = accounts.find((account) => account.id === value);
          if (!nextAccount?.openingBalances.some((balance) => balance.currency === transactionCurrency)) setTransactionCurrency(nextAccount?.openingBalances[0]?.currency ?? null);
          setDestinationAccountId('');
        }} />
        {sourceAccount ? <ChoiceGroup label={t('currency')} options={sourceAccount.openingBalances.map((balance) => ({ label: balance.currency, value: balance.currency }))} selected={transactionCurrency ?? ''} onSelect={(value) => { setTransactionCurrency(value as MoneyCurrencyCode); setDestinationAccountId(''); }} /> : null}
        {type === 'transfer' ? (
          destinationAccounts.length > 0
            ? <ChoiceGroup label={t('destinationAccount')} options={destinationAccounts.map((account) => ({ label: account.name, value: account.id }))} selected={destinationAccountId} onSelect={setDestinationAccountId} />
            : <ErrorState message={t('noCompatibleDestinationAccount')} />
        ) : <ChoiceGroup label={t('category')} optionalLabel={t('optional')} options={applicableCategories.map((category) => ({ label: category.names[locale], value: category.id }))} selected={categoryId} onSelect={setCategoryId} />}
        <AppTextField autoCapitalize="sentences" label={t('description')} onChangeText={setDescription} value={description} />
        <AppTextField autoCapitalize="none" label={t('transactionDate')} onChangeText={setDate} placeholder="YYYY-MM-DD" value={date} />
        <PrimaryButton label={status === 'saving' ? t('saving') : t('save')} onPress={status === 'saving' ? undefined : () => void save()} />
      </>}
    </Screen>
  );
}

function ChoiceGroup({ label, onSelect, optionalLabel, options, selected }: {
  label: string; onSelect: (value: string) => void; optionalLabel?: string;
  options: { label: string; value: string }[]; selected: string;
}) {
  const { theme } = useSettings();
  return <View style={styles.group}>
    <Text style={[styles.label, { color: theme.text }]}>{label}{optionalLabel ? ` (${optionalLabel})` : ''}</Text>
    <View style={styles.choices}>{options.map((option) => {
      const active = option.value === selected;
      return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={option.value} onPress={() => onSelect(option.value)} style={[styles.choice, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }]}>
        <Text style={[styles.choiceLabel, { color: active ? theme.onPrimary : theme.text }]}>{option.label}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44 },
  backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  group: { gap: spacing.sm, marginBottom: spacing.lg },
  label: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderRadius: radii.lg, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
});
