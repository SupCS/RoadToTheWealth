import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { themes, type AppTheme, type ThemeId } from '@/src/design/themes';
import { messages, type Locale } from '@/src/i18n/translations';

const SETTINGS_KEY = 'rttw.preferences.v1';

type SettingsContextValue = {
  isReady: boolean;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  setThemeId: (themeId: ThemeId) => void;
  theme: AppTheme;
  themeId: ThemeId;
  t: (key: keyof (typeof messages)['en']) => string;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'uk' || value === 'ru';
}

function isThemeId(value: unknown): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [themeId, setThemeIdState] = useState<ThemeId>('wealth');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function restore() {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            const settings = parsed as { locale?: unknown; themeId?: unknown };
            if (isLocale(settings.locale)) setLocaleState(settings.locale);
            if (isThemeId(settings.themeId)) setThemeIdState(settings.themeId);
          }
        }
      } catch {
        // Invalid local preferences should never prevent the app from opening.
      } finally {
        setIsReady(true);
      }
    }

    void restore();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ locale, themeId }));
  }, [isReady, locale, themeId]);

  const value = useMemo<SettingsContextValue>(() => {
    const theme = themes.find((item) => item.id === themeId) ?? themes[0]!;
    return {
      isReady,
      locale,
      setLocale: setLocaleState,
      setThemeId: setThemeIdState,
      theme,
      themeId,
      t: (key) => messages[locale][key],
    };
  }, [isReady, locale, themeId]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
