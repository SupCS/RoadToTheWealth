import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ErrorState, layoutStyles, LoadingState } from '@/src/design/layout';
import { useLatestRates } from '@/src/fx/use-fx';
import { formatDate, formatDateTime, formatRate } from '@/src/i18n/formatters';
import { useSettings } from '@/src/settings/settings-context';

export function RatesWidget() {
  const router = useRouter();
  const {
    baseCurrency,
    enabledCurrencies,
    locale,
    isPairInverted,
    t,
    theme,
  } = useSettings();
  const { error, fetchedAt, loading, rates, refresh } = useLatestRates(baseCurrency, enabledCurrencies);

  return (
    <View>
      <View style={styles.headingRow}>
        <Text style={[layoutStyles.sectionTitle, styles.heading, { color: theme.text }]}>{t('exchangeRates')}</Text>
        <Pressable accessibilityLabel={t('moneyCalculator')} accessibilityRole="button" onPress={() => router.push('/fx/calculator')} style={[styles.calculatorButton, { borderColor: theme.border }]}>
          <MaterialCommunityIcons color={theme.primary} name="calculator-variant-outline" size={19} />
          <Text style={[styles.calculatorLabel, { color: theme.primary }]}>{t('calculator')}</Text>
        </Pressable>
      </View>
      <Card>
        {loading ? <LoadingState label={t('loading')} /> : null}
        {!loading && error && rates.length === 0 ? <ErrorState message={t('ratesUnavailable')} onRetry={() => void refresh()} retryLabel={t('retry')} /> : null}
        {!loading && !error && enabledCurrencies.filter((code) => code !== baseCurrency).length === 0 ? <Text style={[styles.message, { color: theme.muted }]}>{t('noCurrencies')}</Text> : null}
        {rates.map((item, index) => {
          const inverted = isPairInverted(baseCurrency, item.quote as typeof baseCurrency);
          return (
            <Pressable
            accessibilityRole="button"
            key={`${item.base}-${item.quote}`}
            onPress={() => router.push({ pathname: '/fx/[quote]', params: { quote: item.quote } })}
            style={[styles.rateRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <View>
              <Text style={[styles.pair, { color: theme.text }]}>{inverted ? `${item.quote}/${item.base}` : `${item.base}/${item.quote}`}</Text>
              <Text style={[styles.date, { color: theme.muted }]}>{formatDate(item.date, locale)}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: theme.text }]}>{formatRate(inverted ? 1 / item.rate : item.rate, locale)}</Text>
              <MaterialCommunityIcons color={theme.muted} name="chevron-right" size={20} />
            </View>
            </Pressable>
          );
        })}
        {rates.length > 0 ? <Text style={[styles.hint, { color: theme.muted }]}>{t('ratesHint')}</Text> : null}
        {fetchedAt ? <Text style={[styles.updated, { color: theme.muted }]}>{t('updated')}: {formatDateTime(fetchedAt, locale)}</Text> : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heading: { marginBottom: 12 },
  calculatorButton: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 34, paddingHorizontal: 10 },
  calculatorLabel: { fontSize: 12, fontWeight: '800' },
  rateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingVertical: 8 },
  pair: { fontSize: 16, fontWeight: '800' },
  date: { fontSize: 11, marginTop: 2 },
  valueRow: { alignItems: 'center', flexDirection: 'row' },
  value: { fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 10 },
  updated: { fontSize: 10, marginTop: 5 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
