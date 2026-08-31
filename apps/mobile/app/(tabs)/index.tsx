import { StyleSheet, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';

import { Card, layoutStyles, MoneyText, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { money } from '@/src/domain/money/money';
import { RatesWidget } from '@/src/fx/rates-widget';
import { useSettings } from '@/src/settings/settings-context';

export default function HomeScreen() {
  const { locale, t, theme } = useSettings();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader eyebrow="RTTW" title="Road To The Wealth" />
      <Text style={[styles.subtitle, { color: theme.muted }]}>{t('subtitle')}</Text>
      <Card>
        <Text style={[layoutStyles.eyebrow, { color: theme.muted }]}>{t('balance')}</Text>
        <MoneyText locale={locale} value={money(1_248_050n, 'GEL')} variant="display" />
        <View style={[layoutStyles.row, styles.metrics]}>
          <View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>{t('spent')}</Text>
            <MoneyText locale={locale} tone="danger" value={money(184_200n, 'GEL')} variant="metric" />
          </View>
          <View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>{t('goal')}</Text>
            <Text style={[layoutStyles.metric, { color: theme.positive }]}>64%</Text>
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.progress, { backgroundColor: theme.accent }]} />
        </View>
        <Text style={[styles.prototype, { color: theme.muted }]}>{t('prototype')}</Text>
      </Card>
      <Text style={[layoutStyles.sectionTitle, { color: theme.text }]}>{t('accounts')}</Text>
      <Card>
        <Text style={[styles.empty, { color: theme.muted }]}>{t('accountsHint')}</Text>
        <PrimaryButton label={t('viewAccounts')} onPress={() => router.push('/accounts' as Href)} />
      </Card>
      <Text style={[layoutStyles.sectionTitle, { color: theme.text }]}>{t('recent')}</Text>
      <Card>
        <Text style={[styles.empty, { color: theme.muted }]}>{t('noTransactions')}</Text>
        <PrimaryButton label={t('addTransaction')} onPress={() => router.push('/transaction/new')} />
      </Card>
      <RatesWidget />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20, marginTop: -14 },
  metrics: { marginTop: 24 },
  metricLabel: { fontSize: 12, marginBottom: 4 },
  track: { borderRadius: 5, height: 8, marginTop: 18, overflow: 'hidden' },
  progress: { borderRadius: 5, height: 8, width: '64%' },
  prototype: { fontSize: 11, marginTop: 10, textAlign: 'right' },
  empty: { fontSize: 14, textAlign: 'center' },
});
