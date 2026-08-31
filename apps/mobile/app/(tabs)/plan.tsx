import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { EmptyState, Screen, ScreenHeader } from '@/src/design/layout';
import { useSettings } from '@/src/settings/settings-context';

export default function PlanScreen() {
  const { t, theme } = useSettings();
  return (
    <Screen>
      <ScreenHeader title={t('monthlyPlan')} />
      <EmptyState
        description={t('budgetsComing')}
        icon={<MaterialCommunityIcons color={theme.primary} name="target" size={48} />}
        title={t('goals')}
      />
    </Screen>
  );
}
