export type Locale = 'en' | 'uk' | 'ru';

export const locales: { id: Locale; flag: string; label: string }[] = [
  { id: 'en', flag: '🇬🇧', label: 'English' },
  { id: 'uk', flag: '🇺🇦', label: 'Українська' },
  { id: 'ru', flag: '🏴‍☠️', label: 'Русский' },
];

export const messages = {
  en: {
    subtitle: 'Your shared path to financial freedom',
    balance: 'Household balance',
    spent: 'Spent this month',
    goal: 'Emergency fund',
    appearance: 'Color theme',
    language: 'Language',
  },
  uk: {
    subtitle: 'Ваш спільний шлях до фінансової свободи',
    balance: 'Баланс родини',
    spent: 'Витрачено цього місяця',
    goal: 'Резервний фонд',
    appearance: 'Колірна тема',
    language: 'Мова',
  },
  ru: {
    subtitle: 'Ваш общий путь к финансовой свободе',
    balance: 'Семейный баланс',
    spent: 'Потрачено в этом месяце',
    goal: 'Резервный фонд',
    appearance: 'Цветовая тема',
    language: 'Язык',
  },
} satisfies Record<Locale, Record<string, string>>;

