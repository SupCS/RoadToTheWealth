import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Crypto from 'expo-crypto';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Account, Category, Transaction, TransactionDetails } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { AppTextField, ErrorState, LoadingState, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { convertMoney, money, parseMajorAmount, toMajorAmountInput } from '@/src/domain/money/money';
import type { MoneyCurrencyCode } from '@/src/domain/money/currencies';
import { resolveHistoricalRate } from '@/src/fx/historical-rate';
import { resolveCategoryColor, resolveCategoryForeground, resolveCategoryIcon } from '@/src/features/categories/category-appearance';
import { useSettings } from '@/src/settings/settings-context';

type EntryType = Extract<Transaction['transactionType'], 'expense' | 'income' | 'transfer'>;

export default function NewTransactionScreen() {
  const { copyId, id } = useLocalSearchParams<{ copyId?: string; id?: string }>();
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const router = useRouter();
  const { locale, t, theme } = useSettings();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<MoneyCurrencyCode | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existing, setExisting] = useState<TransactionDetails | null>(null);
  const [type, setType] = useState<EntryType>('expense');
  const [accountId, setAccountId] = useState('');
  const [transactionCurrency, setTransactionCurrency] = useState<MoneyCurrencyCode | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitCategoryIds, setSplitCategoryIds] = useState<string[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [manualRate, setManualRate] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(Boolean(id || copyId));

  async function load() {
    setStatus('loading');
    try {
      const household = await repository.getActiveHousehold();
      if (!household) throw new Error('Household missing');
      const [member, allAccounts, allCategories, details] = await Promise.all([
        repository.getActiveMember(household.id), repository.listAccounts(household.id), repository.listCategories(household.id),
        id || copyId ? repository.getTransaction(id ?? copyId!) : Promise.resolve(null),
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
      if ((id || copyId) && !details) throw new Error('Transaction missing');
      if (details) {
        if (details.transaction.transactionType === 'transfer') throw new Error('Transfer editing is not supported here');
        const transaction = details.transaction;
        const absoluteAmount = transaction.originalAmount.amountMinor < 0n ? -transaction.originalAmount.amountMinor : transaction.originalAmount.amountMinor;
        if (id) setExisting(details);
        setType(transaction.transactionType as EntryType);
        setAccountId(transaction.accountId);
        setTransactionCurrency(transaction.originalAmount.currency);
        setAmount(toMajorAmountInput(money(absoluteAmount, transaction.originalAmount.currency)));
        setDate(copyId ? todayLocal() : transaction.transactionDate);
        setDescription(transaction.description ?? '');
        if (transaction.fxSnapshot?.provider === 'manual') setManualRate(transaction.fxSnapshot.rateDecimal);
        setCategoryId(transaction.categoryId ?? '');
        if (details.splits.length > 0) {
          setSplitEnabled(true);
          setSplitCategoryIds(details.splits.map((split) => split.categoryId));
          setSplitAmounts(Object.fromEntries(details.splits.map((split) => {
            const absoluteSplit = split.amount.amountMinor < 0n ? -split.amount.amountMinor : split.amount.amountMinor;
            return [split.categoryId, toMajorAmountInput(money(absoluteSplit, split.amount.currency))];
          })));
        }
      }
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { void load(); }, [copyId, id, repository]);
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
        let feeMoney = null;
        if (feeAmount.trim()) {
          try {
            const parsedFee = parseMajorAmount(feeAmount, enteredAmount.currency);
            if (parsedFee.amountMinor <= 0n) throw new Error('Fee must be positive');
            feeMoney = money(-parsedFee.amountMinor, parsedFee.currency);
          } catch {
            setStatus('ready');
            setValidationError(t('invalidTransferFee'));
            return;
          }
        }
        const feeId = feeMoney ? Crypto.randomUUID() : null;
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
          { id: Crypto.randomUUID(), householdId, debitTransactionId: debitId, creditTransactionId: creditId, feeTransactionId: feeId,
            sentAmount: enteredAmount, receivedAmount: enteredAmount, createdAt: now, updatedAt: now,
            createdByMemberId: memberId, updatedByMemberId: memberId, revision: 1, deletedAt: null },
          feeMoney && feeId ? {
            ...common, id: feeId, accountId: account.id, categoryId: null, transactionType: 'expense',
            originalAmount: feeMoney,
            reportingAmount: feeMoney.currency === baseCurrency ? feeMoney : null,
            status: feeMoney.currency === baseCurrency ? 'confirmed' : 'fx_pending',
            description: t('transferFee'),
          } : undefined,
        );
        router.replace('/transactions' as Href);
        return;
      }
      const transactionId = existing?.transaction.id ?? Crypto.randomUUID();
      const splits = [];
      if (splitEnabled) {
        if (splitCategoryIds.length < 2) {
          setStatus('ready');
          setValidationError(t('splitNeedsCategories'));
          return;
        }
        let splitTotal = 0n;
        for (const selectedCategoryId of splitCategoryIds) {
          try {
            const splitAmount = parseMajorAmount(splitAmounts[selectedCategoryId] ?? '', enteredAmount.currency);
            if (splitAmount.amountMinor <= 0n) throw new Error('Split must be positive');
            splitTotal += splitAmount.amountMinor;
            splits.push({
              id: Crypto.randomUUID(), householdId, transactionId, categoryId: selectedCategoryId,
              amount: money(type === 'expense' ? -splitAmount.amountMinor : splitAmount.amountMinor, splitAmount.currency),
              createdAt: now, updatedAt: now, createdByMemberId: memberId, updatedByMemberId: memberId,
              revision: 1, deletedAt: null,
            });
          } catch {
            setStatus('ready');
            setValidationError(t('invalidSplitAmount'));
            return;
          }
        }
        if (splitTotal !== enteredAmount.amountMinor) {
          setStatus('ready');
          setValidationError(t('splitTotalMismatch'));
          return;
        }
      }
      let reportingAmount = isBaseCurrency ? signedAmount : null;
      let fxSnapshot: Transaction['fxSnapshot'] = null;
      if (!isBaseCurrency) {
        if (manualRate.trim()) {
          try {
            reportingAmount = convertMoney(signedAmount, baseCurrency, manualRate.trim().replace(',', '.'));
            fxSnapshot = { rateDecimal: manualRate.trim().replace(',', '.'), provider: 'manual', requestedDate: date, effectiveDate: date };
          } catch {
            setStatus('ready');
            setValidationError(t('invalidManualRate'));
            return;
          }
        } else if (
          existing?.transaction.fxSnapshot
          && existing.transaction.originalAmount.currency === signedAmount.currency
          && existing.transaction.transactionDate === date
          && existing.transaction.reportingAmount?.currency === baseCurrency
        ) {
          const preserved = existing.transaction.fxSnapshot;
          reportingAmount = convertMoney(signedAmount, baseCurrency, preserved.rateDecimal);
          fxSnapshot = preserved;
        } else {
          try {
            const resolved = await resolveHistoricalRate(db, signedAmount.currency, baseCurrency, date);
            reportingAmount = convertMoney(signedAmount, baseCurrency, resolved.rateDecimal);
            fxSnapshot = {
              rateDecimal: resolved.rateDecimal,
              provider: resolved.provider,
              requestedDate: resolved.requestedDate,
              effectiveDate: resolved.effectiveDate,
            };
          } catch {
            // Offline writes remain valid; the pending transaction can be completed later.
          }
        }
      }
      await repository.saveTransaction({
        id: transactionId, householdId, accountId: account.id, memberId, categoryId: splitEnabled ? null : categoryId || null,
        transactionType: type, transactionDate: date, postingDate: null, source: 'manual',
        status: reportingAmount ? 'confirmed' : 'fx_pending', originalAmount: signedAmount,
        reportingAmount, fxSnapshot,
        description: description.trim() || null, notes: existing?.transaction.notes ?? null,
        createdAt: existing?.transaction.createdAt ?? now, updatedAt: now,
        createdByMemberId: existing?.transaction.createdByMemberId ?? memberId, updatedByMemberId: memberId,
        revision: (existing?.transaction.revision ?? 0) + 1, deletedAt: null,
      }, splits);
      router.replace('/transactions' as Href);
    } catch {
      setStatus('ready');
      setValidationError(t('transactionSaveError'));
    }
  }

  function deleteExisting() {
    if (!existing || !memberId) return;
    Alert.alert(t('deleteTransaction'), t('deleteTransactionConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => void repository.softDeleteTransaction(existing.transaction.id, new Date().toISOString(), memberId).then(() => router.replace('/transactions' as Href)).catch(() => Alert.alert(t('transactionDeleteError'))) },
    ]);
  }

  if (status === 'loading') return <Screen><LoadingState label={t('loading')} /></Screen>;
  if (status === 'error') return <Screen><ErrorState message={t('transactionContextError')} onRetry={() => void load()} retryLabel={t('retry')} /></Screen>;

  return (
    <Screen>
      <View style={styles.topBar}><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <MaterialCommunityIcons color={theme.primary} name="arrow-left" size={24} /><Text style={[styles.backLabel, { color: theme.primary }]}>{t('back')}</Text>
      </Pressable>{existing ? <View style={styles.editActions}>
        <Pressable accessibilityLabel={t('copyTransaction')} accessibilityRole="button" onPress={() => router.replace(`/transaction/new?copyId=${existing.transaction.id}`)} style={[styles.editAction, { backgroundColor: theme.surface, borderColor: theme.border }]}><MaterialCommunityIcons color={theme.primary} name="content-copy" size={22} /></Pressable>
        <Pressable accessibilityLabel={t('deleteTransaction')} accessibilityRole="button" onPress={deleteExisting} style={[styles.editAction, { backgroundColor: theme.surface, borderColor: theme.border }]}><MaterialCommunityIcons color={theme.danger} name="trash-can-outline" size={23} /></Pressable>
      </View> : null}</View>
      <ScreenHeader title={existing ? t('editTransaction') : copyId ? t('copyTransaction') : t('addTransaction')} />
      <ChoiceGroup label={t('transactionType')} options={[{ label: t('expense'), value: 'expense' }, { label: t('income'), value: 'income' }, { label: t('transfer'), value: 'transfer' }]} selected={type} onSelect={(value) => changeType(value as EntryType)} />
      {accounts.length === 0 ? <ErrorState message={t('noActiveAccountsForTransaction')} /> : <>
        <AppTextField error={validationError ?? undefined} keyboardType="decimal-pad" label={t('amount')} onChangeText={setAmount} placeholder="0.00" value={amount} />
        <AppTextField autoCapitalize="sentences" label={`${t('description')} (${t('optional')})`} onChangeText={setDescription} value={description} />
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
        ) : <>
          {showDetails ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: splitEnabled }} onPress={() => { setSplitEnabled((value) => !value); setCategoryId(''); }} style={[styles.splitToggle, { borderColor: splitEnabled ? theme.primary : theme.border, backgroundColor: splitEnabled ? theme.primary : theme.surface }]}>
            <MaterialCommunityIcons color={splitEnabled ? theme.onPrimary : theme.text} name={splitEnabled ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={22} />
            <Text style={[styles.choiceLabel, { color: splitEnabled ? theme.onPrimary : theme.text }]}>{t('splitTransaction')}</Text>
          </Pressable> : null}
          {splitEnabled ? <>
            <MultiChoiceGroup label={t('splitCategories')} options={applicableCategories.map((category) => ({ label: categoryLabel(category, categories, locale), value: category.id }))} selected={splitCategoryIds} onToggle={(value) => {
              setSplitCategoryIds((current) => current.includes(value) ? current.filter((id) => id !== value) : [...current, value]);
              setSplitAmounts((current) => ({ ...current, [value]: current[value] ?? '' }));
            }} />
            {splitCategoryIds.map((id) => <AppTextField key={id} keyboardType="decimal-pad" label={`${categoryLabel(categories.find((category) => category.id === id)!, categories, locale)} · ${t('amount')}`} onChangeText={(value) => setSplitAmounts((current) => ({ ...current, [id]: value }))} value={splitAmounts[id] ?? ''} />)}
          </> : <CategoryChoiceGroup categories={applicableCategories} label={t('category')} locale={locale} onSelect={setCategoryId} selected={categoryId} allCategories={categories} />}
        </>}
        {type === 'transfer' ? <AppTextField keyboardType="decimal-pad" label={`${t('transferFee')} (${t('optional')})`} onChangeText={setFeeAmount} value={feeAmount} /> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails((value) => !value)} style={styles.detailsButton}>
          <MaterialCommunityIcons color={theme.primary} name={showDetails ? 'chevron-up' : 'tune-variant'} size={21} />
          <Text style={[styles.detailsLabel, { color: theme.primary }]}>{t(showDetails ? 'fewerDetails' : 'additionalDetails')}</Text>
        </Pressable>
        {showDetails ? <>
          {type !== 'transfer' && transactionCurrency && baseCurrency && transactionCurrency !== baseCurrency ? <AppTextField keyboardType="decimal-pad" label={`${t('manualRate')} · 1 ${transactionCurrency} = ? ${baseCurrency} (${t('optional')})`} onChangeText={setManualRate} placeholder={t('automaticRate')} value={manualRate} /> : null}
          <AppTextField autoCapitalize="none" label={t('transactionDate')} onChangeText={setDate} placeholder="YYYY-MM-DD" value={date} />
        </> : null}
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

function MultiChoiceGroup({ label, onToggle, options, selected }: {
  label: string; onToggle: (value: string) => void; options: { label: string; value: string }[]; selected: string[];
}) {
  const { theme } = useSettings();
  return <View style={styles.group}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <View style={styles.choices}>{options.map((option) => {
      const active = selected.includes(option.value);
      return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} key={option.value} onPress={() => onToggle(option.value)} style={[styles.choice, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }]}>
        <Text style={[styles.choiceLabel, { color: active ? theme.onPrimary : theme.text }]}>{option.label}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

function CategoryChoiceGroup({ allCategories, categories, label, locale, onSelect, selected }: {
  allCategories: Category[]; categories: Category[]; label: string; locale: 'en' | 'uk' | 'ru'; onSelect: (value: string) => void; selected: string;
}) {
  const { t, theme } = useSettings();
  const router = useRouter();
  return <View style={styles.group}><View style={styles.categoryHeading}><Text style={[styles.label, { color: theme.text }]}>{label} ({t('optional')})</Text><Pressable accessibilityRole="button" onPress={() => router.push('/categories' as Href)} style={styles.editCategoriesButton}><MaterialCommunityIcons color={theme.primary} name="shape-plus-outline" size={19} /><Text style={[styles.editCategoriesLabel, { color: theme.primary }]}>{t('editCategoryList')}</Text></Pressable></View><View style={styles.categoryChoices}>{categories.map((category) => {
    const active = category.id === selected;
    const color = resolveCategoryColor(theme, category.colorToken);
    return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={category.id} onPress={() => onSelect(active ? '' : category.id)} style={[styles.categoryChoice, { backgroundColor: theme.surface, borderColor: active ? color : theme.border, borderWidth: active ? 3 : 1 }]}>
      <View style={[styles.categoryChoiceIcon, { backgroundColor: color }]}><MaterialCommunityIcons color={resolveCategoryForeground(theme, category.colorToken, category.iconColor)} name={resolveCategoryIcon(category.icon)} size={21} /></View>
      <Text numberOfLines={2} style={[styles.categoryChoiceLabel, { color: theme.text }]}>{categoryLabel(category, allCategories, locale)}</Text>
    </Pressable>;
  })}</View></View>;
}

function categoryLabel(category: Category, categories: Category[], locale: 'en' | 'uk' | 'ru'): string {
  const parent = category.parentId ? categories.find((candidate) => candidate.id === category.parentId) : null;
  return parent ? `${parent.names[locale]} › ${category.names[locale]}` : category.names[locale];
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
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }, backButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  editActions: { flexDirection: 'row', gap: spacing.sm }, editAction: { alignItems: 'center', borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  group: { gap: spacing.sm, marginBottom: spacing.lg },
  label: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderRadius: radii.lg, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  splitToggle: { alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  categoryHeading: { alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }, editCategoriesButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 44 }, editCategoriesLabel: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold }, categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, categoryChoice: { alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, width: '48%' }, categoryChoiceIcon: { alignItems: 'center', borderRadius: 17, height: 34, justifyContent: 'center', width: 34 }, categoryChoiceLabel: { flex: 1, fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
  detailsButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, minHeight: 44 },
  detailsLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
});
