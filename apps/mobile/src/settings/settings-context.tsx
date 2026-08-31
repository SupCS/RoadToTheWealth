import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { themes, type AppTheme, type ThemeId } from '@/src/design/themes';
import { messages, type Locale } from '@/src/i18n/translations';

const SETTINGS_KEY = 'rttw.preferences.v1';

export const currencyCatalog = ['GEL', 'USD', 'EUR', 'UAH', 'GBP', 'TRY', 'PLN', 'CHF', 'RUB'] as const;
export type CurrencyCode = (typeof currencyCatalog)[number];

type SettingsContextValue = {
  isReady: boolean;
  baseCurrency: CurrencyCode;
  enabledCurrencies: CurrencyCode[];
  locale: Locale;
  setBaseCurrency: (currency: CurrencyCode) => void;
  setEnabledCurrencies: (currencies: CurrencyCode[]) => void;
  setLocale: (locale: Locale) => void;
  setThemeId: (themeId: ThemeId) => void;
  isPairInverted: (base: CurrencyCode, quote: CurrencyCode) => boolean;
  togglePairInverted: (base: CurrencyCode, quote: CurrencyCode) => void;
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

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && currencyCatalog.includes(value as CurrencyCode);
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [themeId, setThemeIdState] = useState<ThemeId>('wealth');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('GEL');
  const [enabledCurrencies, setEnabledCurrencies] = useState<CurrencyCode[]>(['USD', 'EUR', 'UAH']);
  const [invertedPairs, setInvertedPairs] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function restore() {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            const settings = parsed as { baseCurrency?: unknown; enabledCurrencies?: unknown; invertedPairs?: unknown; locale?: unknown; themeId?: unknown };
            if (isLocale(settings.locale)) setLocaleState(settings.locale);
            if (isThemeId(settings.themeId)) setThemeIdState(settings.themeId);
            if (isCurrencyCode(settings.baseCurrency)) setBaseCurrency(settings.baseCurrency);
            if (Array.isArray(settings.enabledCurrencies)) {
              const validCurrencies = settings.enabledCurrencies.filter(isCurrencyCode);
              setEnabledCurrencies([...new Set(validCurrencies)]);
            }
            if (Array.isArray(settings.invertedPairs)) {
              setInvertedPairs(settings.invertedPairs.filter((value): value is string => typeof value === 'string'));
            }
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
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ baseCurrency, enabledCurrencies, invertedPairs, locale, themeId }));
  }, [baseCurrency, enabledCurrencies, invertedPairs, isReady, locale, themeId]);

  const value = useMemo<SettingsContextValue>(() => {
    const theme = themes.find((item) => item.id === themeId) ?? themes[0]!;
    return {
      baseCurrency,
      enabledCurrencies,
      isReady,
      locale,
      setBaseCurrency,
      setEnabledCurrencies,
      setLocale: setLocaleState,
      setThemeId: setThemeIdState,
      theme,
      themeId,
      t: (key) => messages[locale][key],
      isPairInverted: (base, quote) => invertedPairs.includes(`${base}/${quote}`),
      togglePairInverted: (base, quote) => {
        const key = `${base}/${quote}`;
        setInvertedPairs((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
      },
    };
  }, [baseCurrency, enabledCurrencies, invertedPairs, isReady, locale, themeId]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
