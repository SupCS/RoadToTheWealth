import { StyleSheet, Text } from 'react-native';
import { type Href, useRouter } from 'expo-router';

import { Card, layoutStyles, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { BalanceWidgets } from '@/src/features/dashboard/balance-widgets';
import { RatesWidget } from '@/src/fx/rates-widget';
import { useSettings } from '@/src/settings/settings-context';

export default function HomeScreen() {
  const { t, theme } = useSettings();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader eyebrow="RTTW" title="Road To The Wealth" />
      <Text style={[styles.subtitle, { color: theme.muted }]}>{t('subtitle')}</Text>
      <BalanceWidgets />
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
  empty: { fontSize: 14, textAlign: 'center' },
});
