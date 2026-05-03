import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'cnad-locale';

export type AppLocale = 'zh-Hant' | 'en';

type Ctx = {
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
};

const LocaleCtx = createContext<Ctx | null>(null);

function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'zh-Hant';
  const s = window.localStorage.getItem(STORAGE_KEY);
  return s === 'en' ? 'en' : 'zh-Hant';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale());

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota */
    }
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-Hant';
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-Hant';
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Ctx {
  const v = useContext(LocaleCtx);
  if (!v) throw new Error('useLocale must be used within LocaleProvider');
  return v;
}
