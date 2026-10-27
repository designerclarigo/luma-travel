import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { createExchangeStore } from '@/lib/exchange-rates';
import { displayMoney, moneyDefaults, ratesAreFresh, resolveMoneyCountry, currencyForCountry, usableRate, type ExchangeReport } from '@/lib/money';
import { useTravel } from './travel-provider';

type CurrencyContextValue = { country: string | null; currency: string; effectiveCurrency: string; locale: string; inputLocale: string; rate: number; report: ExchangeReport | null; loading: boolean; error: string; stale: boolean; format: (usd: number) => string; refresh: () => Promise<void> };
const Context = createContext<CurrencyContextValue | null>(null);
export function CurrencyProvider({ children }: PropsWithChildren) {
  const { data } = useTravel(); const locales = useLocales(); const preferences = data?.settings.money ?? moneyDefaults;
  const country = resolveMoneyCountry(preferences, data?.homeLocation?.country, data?.profile.location, locales[0]?.regionCode);
  const currency = preferences.override ?? currencyForCountry(country) ?? 'USD'; const locale = `${data?.settings.language ?? 'en'}-${country ?? 'US'}`;
  const hasData = !!data;
  const store = useMemo(() => createExchangeStore(AsyncStorage), []);
  const [report, setReport] = useState<ExchangeReport | null>(null); const [ready, setReady] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [now, setNow] = useState(Date.now);
  const refresh = useCallback(async (force = true) => { setLoading(true); setError(''); try { setReport(await store.refresh(force)); } catch (cause) { setError(cause instanceof TypeError ? 'Couldn’t connect for exchange rates. Saved rates or original USD amounts remain available.' : cause instanceof Error ? cause.message : 'Exchange rates are unavailable.'); } finally { setLoading(false); setNow(Date.now()); } }, [store]);
  useEffect(() => { let alive = true; void store.load().then((saved) => { if (alive) { setReport(saved); setReady(true); } }); return () => { alive = false; }; }, [store]);
  useEffect(() => {
    if (!ready || !hasData) return;
    const update = () => { setNow(Date.now()); if (currency !== 'USD') void refresh(false); };
    update(); const timer = setInterval(update, 3600000); const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [ready, hasData, currency, refresh]);
  const rate = usableRate(currency, report, now); const effectiveCurrency = rate === null ? 'USD' : currency;
  return <Context.Provider value={{ country, currency, effectiveCurrency, locale, inputLocale: locales[0]?.languageTag ?? locale, rate: rate ?? 1, report, loading: loading || !ready, error, stale: !!report && !ratesAreFresh(report, now), format: (amount) => displayMoney(amount, currency, locale, report, now), refresh: () => refresh(true) }}>{children}</Context.Provider>;
}
export function useCurrency() { const context = useContext(Context); if (!context) throw new Error('CurrencyProvider is missing.'); return context; }
