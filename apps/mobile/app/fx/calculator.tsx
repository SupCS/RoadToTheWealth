import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextField, Card, ErrorState, LoadingState, MoneyText, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { convertMoney, money, parseMajorAmount } from '@/src/domain/money/money';
import { useLatestRates } from '@/src/fx/use-fx';
import { formatDate, formatRate } from '@/src/i18n/formatters';
import { currencyCatalog, type CurrencyCode, useSettings } from '@/src/settings/settings-context';

export default function MoneyCalculatorScreen() {
  const router = useRouter();
  const { baseCurrency, locale, t, theme } = useSettings();
  const initialTarget = currencyCatalog.find((currency) => currency !== baseCurrency) ?? 'USD';
  const [from, setFrom] = useState<CurrencyCode>(baseCurrency);
  const [to, setTo] = useState<CurrencyCode>(initialTarget);
  const [amount, setAmount] = useState('1');
  const { error, loading, rates, refresh } = useLatestRates(from, [to]);
  const rate = from === to ? { base: from, quote: to, date: todayUtc(), rate: 1 } : rates[0];

  const result = useMemo(() => {
    if (!rate) return null;
    try {
      const source = parseMajorAmount(amount, from);
      return convertMoney(source, to, rate.rate.toString());
    } catch {
      return null;
    }
  }, [amount, from, rate, to]);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return <Screen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
      <MaterialCommunityIcons color={theme.primary} name="arrow-left" size={24} />
      <Text style={[styles.backLabel, { color: theme.primary }]}>{t('back')}</Text>
    </Pressable>
    <ScreenHeader title={t('moneyCalculator')} />
    <AppTextField error={amount.trim() && !result ? t('invalidCalculatorAmount') : undefined} keyboardType="decimal-pad" label={t('amount')} onChangeText={setAmount} placeholder="0.00" value={amount} />
    <CurrencyPicker label={t('fromCurrency')} onSelect={(value) => setFrom(value)} selected={from} />
    <Pressable accessibilityLabel={t('swapCurrencies')} accessibilityRole="button" onPress={swap} style={[styles.swapButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <MaterialCommunityIcons color={theme.primary} name="swap-vertical" size={24} />
      <Text style={[styles.swapLabel, { color: theme.primary }]}>{t('swapCurrencies')}</Text>
    </Pressable>
    <CurrencyPicker label={t('toCurrency')} onSelect={(value) => setTo(value)} selected={to} />
    <Card>
      {loading && from !== to ? <LoadingState label={t('loading')} /> : null}
      {!loading && error && !rate ? <ErrorState message={t('ratesUnavailable')} onRetry={() => void refresh()} retryLabel={t('retry')} /> : null}
      {result && rate ? <View style={styles.result}>
        <Text style={[styles.resultLabel, { color: theme.muted }]}>{t('calculatedAmount')}</Text>
        <MoneyText locale={locale} value={result} variant="display" />
        <Text style={[styles.rate, { color: theme.muted }]}>1 {from} = {formatRate(rate.rate, locale)} {to}</Text>
        <Text style={[styles.date, { color: theme.muted }]}>{t('rateDate')}: {formatDate(rate.date, locale)}</Text>
      </View> : null}
    </Card>
  </Screen>;
}

function CurrencyPicker({ label, onSelect, selected }: { label: string; onSelect: (value: CurrencyCode) => void; selected: CurrencyCode }) {
  const { theme } = useSettings();
  return <View style={styles.group}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <View style={styles.choices}>{currencyCatalog.map((currency) => {
      const active = selected === currency;
      return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={currency} onPress={() => onSelect(currency)} style={[styles.choice, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }]}>
        <Text style={[styles.choiceLabel, { color: active ? theme.onPrimary : theme.text }]}>{currency}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

function todayUtc() { return new Date().toISOString().slice(0, 10); }

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44 },
  backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  group: { gap: spacing.sm, marginBottom: spacing.lg },
  label: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderRadius: radii.lg, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  choiceLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  swapButton: { alignItems: 'center', alignSelf: 'center', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44, paddingHorizontal: spacing.lg },
  swapLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  result: { alignItems: 'center', gap: spacing.sm },
  resultLabel: { fontSize: fontSizes.caption },
  rate: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  date: { fontSize: fontSizes.caption },
});
