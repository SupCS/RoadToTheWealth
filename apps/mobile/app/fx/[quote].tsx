import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Screen } from '@/src/design/layout';
import { useRateHistory } from '@/src/fx/use-fx';
import { formatDate, formatRate } from '@/src/i18n/formatters';
import { currencyCatalog, type CurrencyCode, useSettings } from '@/src/settings/settings-context';

function isCurrencyCode(value: string): value is CurrencyCode {
  return currencyCatalog.includes(value as CurrencyCode);
}

export default function RateHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ quote?: string }>();
  const { baseCurrency, isPairInverted, locale, t, theme, togglePairInverted } = useSettings();
  const quote = params.quote && isCurrencyCode(params.quote) ? params.quote : 'USD';
  const inverted = isPairInverted(baseCurrency, quote);
  const pairBase = inverted ? quote : baseCurrency;
  const pairQuote = inverted ? baseCurrency : quote;
  const { error, loading, rates } = useRateHistory(pairBase, pairQuote);
  const values = rates.map((item) => item.rate);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min || 1;
  const latest = rates.at(-1);

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <MaterialCommunityIcons color={theme.primary} name="chevron-left" size={28} />
        <Text style={[styles.backText, { color: theme.primary }]}>{t('back')}</Text>
      </Pressable>
      <Text style={[styles.eyebrow, { color: theme.muted }]}>{t('rateHistory')}</Text>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>{pairBase}/{pairQuote}</Text>
        <Pressable
          accessibilityLabel={t('invertRates')}
          accessibilityRole="button"
          onPress={() => togglePairInverted(baseCurrency, quote)}
          style={({ pressed }) => [styles.swapButton, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons color={theme.primary} name="swap-horizontal" size={26} />
        </Pressable>
      </View>
      <Text style={[styles.period, { color: theme.muted }]}>{t('oneMonth')}</Text>

      <Card>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{t('ratesUnavailable')}</Text> : null}
        {latest ? (
          <>
            <Text style={[styles.latest, { color: theme.text }]}>{formatRate(latest.rate, locale)}</Text>
            <View style={styles.chart}>
              {rates.map((item) => {
                const height = 24 + ((item.rate - min) / span) * 96;
                return <View key={item.date} style={[styles.bar, { backgroundColor: theme.accent, height }]} />;
              })}
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.range, { color: theme.muted }]}>{rates[0] ? formatDate(rates[0].date, locale) : ''}</Text>
              <Text style={[styles.range, { color: theme.muted }]}>{formatDate(latest.date, locale)}</Text>
            </View>
            <View style={[styles.stats, { borderTopColor: theme.border }]}>
              <Text style={[styles.stat, { color: theme.muted }]}>{t('minimum')}: {formatRate(min, locale)}</Text>
              <Text style={[styles.stat, { color: theme.muted }]}>{t('maximum')}: {formatRate(max, locale)}</Text>
            </View>
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', marginBottom: 20, marginLeft: -8 },
  backText: { fontSize: 15, fontWeight: '700' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 34, fontWeight: '900', marginTop: 4 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  swapButton: { alignItems: 'center', borderRadius: 13, borderWidth: 1, justifyContent: 'center', padding: 9 },
  period: { fontSize: 14, marginBottom: 18, marginTop: 3 },
  latest: { fontSize: 30, fontVariant: ['tabular-nums'], fontWeight: '800' },
  chart: { alignItems: 'flex-end', flexDirection: 'row', gap: 2, height: 140, marginTop: 20 },
  bar: { borderRadius: 3, flex: 1, minWidth: 2 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  range: { fontSize: 10 },
  stats: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 12 },
  stat: { fontSize: 12, fontVariant: ['tabular-nums'] },
  error: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
