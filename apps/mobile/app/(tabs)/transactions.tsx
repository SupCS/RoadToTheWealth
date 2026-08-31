import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { EmptyState, Screen, ScreenHeader } from '@/src/design/layout';
import { useSettings } from '@/src/settings/settings-context';

export default function TransactionsScreen() {
  const { t, theme } = useSettings();
  return (
    <Screen>
      <ScreenHeader title={t('transactions')} />
      <EmptyState
        description={t('noTransactionsHint')}
        icon={<MaterialCommunityIcons color={theme.primary} name="receipt-text-outline" size={46} />}
        title={t('noTransactions')}
      />
    </Screen>
  );
}
