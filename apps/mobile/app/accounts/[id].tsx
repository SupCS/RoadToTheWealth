import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Crypto from 'expo-crypto';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextField, ErrorState, LoadingState, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import type { Account } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { parseMajorAmount, toMajorAmountInput } from '@/src/domain/money/money';
import type { MoneyCurrencyCode } from '@/src/domain/money/currencies';
import { ensureLocalLedgerContext } from '@/src/domain/household/ensure-local-context';
import { currencyCatalog, useSettings } from '@/src/settings/settings-context';

type AccountType = Account['accountType'];
const accountTypes: AccountType[] = ['cash', 'debit_card', 'credit_card', 'current', 'savings', 'deposit', 'investment', 'debt', 'e_wallet', 'custom'];

export default function AccountEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const router = useRouter();
  const { baseCurrency, t, theme } = useSettings();
  const [account, setAccount] = useState<Account | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [balanceInputs, setBalanceInputs] = useState<Partial<Record<MoneyCurrencyCode, string>>>({ [baseCurrency]: '0' });
  const [primaryCurrency, setPrimaryCurrency] = useState<MoneyCurrencyCode>(baseCurrency);
  const [ownershipScope, setOwnershipScope] = useState<Account['ownershipScope']>('personal');
  const [accountType, setAccountType] = useState<AccountType>('current');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const existing = isNew ? null : await repository.getAccount(id);
        const context = existing
          ? null
          : await ensureLocalLedgerContext(repository, {
            baseCurrency, createId: Crypto.randomUUID, now: () => new Date().toISOString(),
          });
        const household = context?.household ?? await repository.getActiveHousehold();
        if (!household) throw new Error('Household missing');
        const member = context?.member ?? await repository.getActiveMember(household.id);
        if (!member) throw new Error('Member missing');
        setHouseholdId(household.id);
        setMemberId(member.id);
        if (existing) {
          setAccount(existing);
          setName(existing.name);
          const inputs = Object.fromEntries(existing.openingBalances.map((balance) => [balance.currency, toMajorAmountInput(balance)]));
          setBalanceInputs(inputs);
          setPrimaryCurrency(existing.primaryCurrency);
          setOwnershipScope(existing.ownershipScope);
          setAccountType(existing.accountType);
        }
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }
    void load();
  }, [baseCurrency, id, isNew, repository]);

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError(t('accountNameRequired'));
      return;
    }
    const openingBalances = [];
    for (const [code, value] of Object.entries(balanceInputs)) {
      try {
        openingBalances.push(parseMajorAmount(value ?? '', code as MoneyCurrencyCode));
      } catch {
        setValidationError(`${t('invalidAmount')} (${code})`);
        return;
      }
    }
    if (!householdId || !memberId) return;
    setValidationError(null);
    setStatus('saving');
    const now = new Date().toISOString();
    try {
      await repository.saveAccount({
        id: account?.id ?? Crypto.randomUUID(),
        householdId,
        ownershipScope,
        ownerMemberId: ownershipScope === 'personal' ? memberId : null,
        name: trimmedName,
        accountType,
        primaryCurrency,
        openingBalances,
        isArchived: account?.isArchived ?? false,
        createdAt: account?.createdAt ?? now,
        updatedAt: now,
        createdByMemberId: account?.createdByMemberId ?? memberId,
        updatedByMemberId: memberId,
        revision: (account?.revision ?? 0) + 1,
        deletedAt: null,
      });
      router.replace('/accounts' as Href);
    } catch (error) {
      setStatus('ready');
      setValidationError(error instanceof Error && error.message.includes('transaction history')
        ? t('currencyHasTransactions') : t('accountSaveError'));
    }
  }

  function archive() {
    if (!account || !memberId) return;
    Alert.alert(t('archiveAccount'), t('archiveAccountConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('archive'), style: 'destructive', onPress: () => {
          setStatus('saving');
          void repository.setAccountArchived(account.id, true, new Date().toISOString(), memberId)
            .then(() => router.replace('/accounts' as Href))
            .catch(() => { setStatus('ready'); setValidationError(t('accountSaveError')); });
        },
      },
    ]);
  }

  if (status === 'loading') return <Screen><LoadingState label={t('loading')} /></Screen>;
  if (status === 'error') return <Screen><ErrorState message={t('accountContextError')} /></Screen>;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <MaterialCommunityIcons color={theme.primary} name="arrow-left" size={24} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>{t('back')}</Text>
      </Pressable>
      <ScreenHeader title={isNew ? t('newAccount') : t('editAccount')} />
      <AppTextField label={t('accountName')} onChangeText={setName} value={name} />
      <MultiChoiceGroup
        label={t('accountCurrencies')}
        options={currencyCatalog.map((value) => ({ label: value, value }))}
        selected={Object.keys(balanceInputs)}
        onSelect={(value) => setBalanceInputs((current) => {
          const code = value as MoneyCurrencyCode;
          if (current[code] === undefined) return { ...current, [code]: '0' };
          if (Object.keys(current).length === 1) return current;
          const next = { ...current };
          delete next[code];
          if (primaryCurrency === code) setPrimaryCurrency(Object.keys(next)[0] as MoneyCurrencyCode);
          return next;
        })}
      />
      {(Object.keys(balanceInputs) as MoneyCurrencyCode[]).map((code) => (
        <AppTextField
          key={code}
          keyboardType="decimal-pad"
          label={`${t('openingBalance')} · ${code}`}
          onChangeText={(value) => setBalanceInputs((current) => ({ ...current, [code]: value }))}
          value={balanceInputs[code] ?? ''}
        />
      ))}
      <ChoiceGroup
        label={t('primaryAccountCurrency')}
        options={(Object.keys(balanceInputs) as MoneyCurrencyCode[]).map((value) => ({ label: value, value }))}
        selected={primaryCurrency}
        onSelect={(value) => setPrimaryCurrency(value as MoneyCurrencyCode)}
      />
      <ChoiceGroup label={t('ownership')} options={[
        { label: t('personalAccount'), value: 'personal' }, { label: t('sharedAccount'), value: 'shared' },
      ]} selected={ownershipScope} onSelect={(value) => setOwnershipScope(value as Account['ownershipScope'])} />
      <ChoiceGroup label={t('accountType')} options={accountTypes.map((value) => ({ label: t(accountTypeKey[value]), value }))} selected={accountType} onSelect={(value) => setAccountType(value as AccountType)} />
      {validationError ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>{validationError}</Text> : null}
      <PrimaryButton label={status === 'saving' ? t('saving') : t('save')} onPress={status === 'saving' ? undefined : () => void save()} />
      {!isNew && !account?.isArchived ? (
        <Pressable accessibilityRole="button" onPress={archive} style={[styles.archiveButton, { borderColor: theme.danger }]}>
          <Text style={[styles.archiveLabel, { color: theme.danger }]}>{t('archiveAccount')}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function ChoiceGroup({ label, onSelect, options, selected }: {
  label: string; onSelect: (value: string) => void; options: { label: string; value: string }[]; selected: string;
}) {
  const { theme } = useSettings();
  return <View style={styles.group}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <View style={styles.choices}>{options.map((option) => {
      const active = option.value === selected;
      return <Pressable accessibilityRole="button" key={option.value} onPress={() => onSelect(option.value)} style={[styles.choice, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }]}>
        <Text style={[styles.choiceLabel, { color: active ? theme.onPrimary : theme.text }]}>{option.label}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

function MultiChoiceGroup({ label, onSelect, options, selected }: {
  label: string; onSelect: (value: string) => void; options: { label: string; value: string }[]; selected: string[];
}) {
  const { t, theme } = useSettings();
  return <View style={styles.group}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <Text style={[styles.choiceHint, { color: theme.muted }]}>{t('accountCurrenciesHint')}</Text>
    <View style={styles.choices}>{options.map((option) => {
      const active = selected.includes(option.value);
      return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} key={option.value} onPress={() => onSelect(option.value)} style={[styles.choice, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }]}>
        <View style={styles.choiceContent}>
          {active ? <MaterialCommunityIcons color={theme.onPrimary} name="check" size={18} /> : null}
          <Text style={[styles.choiceLabel, { color: active ? theme.onPrimary : theme.text }]}>{option.label}</Text>
        </View>
      </Pressable>;
    })}</View>
  </View>;
}

const accountTypeKey = {
  cash: 'accountTypeCash', debit_card: 'accountTypeDebitCard', credit_card: 'accountTypeCreditCard', current: 'accountTypeCurrent',
  savings: 'accountTypeSavings', deposit: 'accountTypeDeposit', investment: 'accountTypeInvestment', debt: 'accountTypeDebt',
  e_wallet: 'accountTypeEWallet', custom: 'accountTypeCustom',
} as const;

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44 },
  backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  group: { gap: spacing.sm, marginBottom: spacing.lg },
  label: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderRadius: radii.lg, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  choiceContent: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  choiceHint: { fontSize: fontSizes.caption, lineHeight: 18 },
  error: { fontSize: fontSizes.body, marginVertical: spacing.md },
  archiveButton: { alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg, minHeight: 48, justifyContent: 'center', padding: spacing.md },
  archiveLabel: { fontSize: fontSizes.button, fontWeight: fontWeights.extraBold },
});
