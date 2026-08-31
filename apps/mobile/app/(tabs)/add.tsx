import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { EmptyState, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { useSettings } from '@/src/settings/settings-context';

export default function AddScreen() {
  const { t, theme } = useSettings();
  return (
    <Screen>
      <ScreenHeader title={t('addTransaction')} />
      <EmptyState
        description={t('addHint')}
        icon={<MaterialCommunityIcons color={theme.primary} name="cash-plus" size={48} />}
        title={t('addTransaction')}
      />
      <PrimaryButton label={t('addTransaction')} />
    </Screen>
  );
}
