import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, layoutStyles } from '@/src/design/layout';
import { useLatestRates } from '@/src/fx/use-fx';
import { useSettings } from '@/src/settings/settings-context';

export function RatesWidget() {
  const router = useRouter();
  const {
    baseCurrency,
    enabledCurrencies,
    locale,
    setWidgetRatesInverted,
    t,
    theme,
    widgetRatesInverted,
  } = useSettings();
  const { error, fetchedAt, loading, rates } = useLatestRates(baseCurrency, enabledCurrencies);

  return (
    <View>
      <View style={styles.headingRow}>
        <Text style={[layoutStyles.sectionTitle, styles.heading, { color: theme.text }]}>{t('exchangeRates')}</Text>
        <Pressable
          accessibilityLabel={t('invertRates')}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setWidgetRatesInverted(!widgetRatesInverted)}
          style={({ pressed }) => [styles.swapButton, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons color={theme.primary} name="swap-horizontal" size={22} />
        </Pressable>
      </View>
      <Card>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {!loading && error && rates.length === 0 ? <Text style={[styles.message, { color: theme.muted }]}>{t('ratesUnavailable')}</Text> : null}
        {!loading && !error && enabledCurrencies.filter((code) => code !== baseCurrency).length === 0 ? <Text style={[styles.message, { color: theme.muted }]}>{t('noCurrencies')}</Text> : null}
        {rates.map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={`${item.base}-${item.quote}`}
            onPress={() => router.push({ pathname: '/fx/[quote]', params: { inverted: widgetRatesInverted ? '1' : '0', quote: item.quote } })}
            style={[styles.rateRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <View>
              <Text style={[styles.pair, { color: theme.text }]}>{widgetRatesInverted ? `${item.quote}/${item.base}` : `${item.base}/${item.quote}`}</Text>
              <Text style={[styles.date, { color: theme.muted }]}>{item.date}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: theme.text }]}>{(widgetRatesInverted ? 1 / item.rate : item.rate).toLocaleString(locale, { maximumFractionDigits: 5 })}</Text>
              <MaterialCommunityIcons color={theme.muted} name="chevron-right" size={20} />
            </View>
          </Pressable>
        ))}
        {rates.length > 0 ? <Text style={[styles.hint, { color: theme.muted }]}>{t('ratesHint')}</Text> : null}
        {fetchedAt ? <Text style={[styles.updated, { color: theme.muted }]}>{t('updated')}: {new Date(fetchedAt).toLocaleString(locale)}</Text> : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heading: { marginBottom: 12 },
  swapButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', padding: 7 },
  rateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingVertical: 8 },
  pair: { fontSize: 16, fontWeight: '800' },
  date: { fontSize: 11, marginTop: 2 },
  valueRow: { alignItems: 'center', flexDirection: 'row' },
  value: { fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 10 },
  updated: { fontSize: 10, marginTop: 5 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
