import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';

import { EmptyState, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { useSettings } from '@/src/settings/settings-context';

export default function TransactionsScreen() {
  const { t, theme } = useSettings();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title={t('transactions')} />
      <EmptyState
        description={t('noTransactionsHint')}
        icon={<MaterialCommunityIcons color={theme.primary} name="receipt-text-outline" size={46} />}
        title={t('noTransactions')}
      />
      <PrimaryButton label={t('addTransaction')} onPress={() => router.push('/transaction/new')} />
    </Screen>
  );
}
