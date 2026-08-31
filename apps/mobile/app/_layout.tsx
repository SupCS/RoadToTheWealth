import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { DATABASE_NAME, migrateDatabase } from '@/src/data/database/migrations';
import { SettingsProvider, useSettings } from '@/src/settings/settings-context';

function RootNavigator() {
  const { theme } = useSettings();
  const isDark = theme.id === 'pirate' || theme.id === 'contrast';
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: theme.background }, headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="accounts/index" />
        <Stack.Screen name="transaction/new" />
        <Stack.Screen name="fx/[quote]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <SettingsProvider>
        <RootNavigator />
      </SettingsProvider>
    </SQLiteProvider>
  );
}
