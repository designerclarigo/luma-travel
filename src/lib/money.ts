import countries from '@/constants/data/countries.json';
import mappings from '@/constants/data/country-currencies.json';

export type MoneyPreferences = { countryCode: string | null; override: string | null };
export type ExchangeReport = { source: 'ExchangeRate-API'; base: 'USD'; updatedAt: number; nextUpdate: number; fetchedAt: number; rates: Record<string, number> };
export const countryCurrencies: Record<string, string> = mappings;
export const currencyCodes = [...new Set(Object.values(mappings))].filter((code) => code !== 'XXX').sort();
export const moneyDefaults: MoneyPreferences = { countryCode: null, override: null };
export const exchangeCacheKey = '@waylo/exchange-rates/v1';
const day = 86400000;
export const currencyForCountry = (country?: string | null) => country ? countryCurrencies[country] ?? null : null;
const normalize = (text: string) => text.trim().toLocaleLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/[.,]/g, '');
export function countryCodeForName(value?: string | null): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase(); if (countries.some((c) => c.code === code)) return code;
  const aliases: Record<string, string> = { usa: 'US', 'united states of america': 'US', uk: 'GB', 'great britain': 'GB', uae: 'AE', bharat: 'IN', 'भारत': 'IN', 'पाकिस्तान': 'PK', 'پاکستان': 'PK', 'south korea': 'KR', vietnam: 'VN', russia: 'RU', turkey: 'TR', taiwan: 'TW' };
  const name = normalize(value); return aliases[name] ?? countries.find((c) => normalize(c.name) === name)?.code ?? null;
}
export function resolveMoneyCountry(preferences: MoneyPreferences, homeCountry?: string, profileLocation?: string, deviceRegion?: string | null) {
  return preferences.countryCode ?? countryCodeForName(homeCountry) ?? countryCodeForName(profileLocation?.split(',').at(-1)) ?? countryCodeForName(deviceRegion);
}
export function validMoneyPreferences(value: unknown): value is MoneyPreferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as MoneyPreferences;
  return (p.countryCode === null || countries.some((c) => c.code === p.countryCode)) && (p.override === null || currencyCodes.includes(p.override));
}
export function validExchangeReport(value: unknown, now = Date.now()): value is ExchangeReport {
  if (!value || typeof value !== 'object') return false;
  const r = value as ExchangeReport;
  return r.source === 'ExchangeRate-API' && r.base === 'USD' && Number.isFinite(r.updatedAt) && r.updatedAt > 0 && r.updatedAt <= now + 300000 && Number.isFinite(r.nextUpdate) && r.nextUpdate > r.updatedAt && Number.isFinite(r.fetchedAt) && r.fetchedAt > 0 && r.fetchedAt <= now + 300000 && !!r.rates && typeof r.rates === 'object' && !Array.isArray(r.rates) && r.rates.USD === 1 && Object.entries(r.rates).every(([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0);
}
export const ratesAreFresh = (report: ExchangeReport, now = Date.now()) => now < report.nextUpdate && now - report.updatedAt < 2 * day;
export function usableRate(currency: string, report?: ExchangeReport | null, now = Date.now()): number | null {
  if (currency === 'USD') return 1;
  if (!report || !validExchangeReport(report, now) || now - report.updatedAt > 7 * day) return null;
  return report.rates[currency] ?? null;
}
export function formatMoney(amount: number, currency = 'USD', locale = 'en-US'): string {
  if (!Number.isFinite(amount)) return '—';
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0 });
  const formatted = formatter.formatToParts(amount).map((part) => part.type === 'currency' && currency === 'PKR' ? '₨' : part.value).join('');
  return `${formatted} ${currency}`;
}
// All legacy and new stored budgets, catalog prices and activity costs are USD.
// Convert only at the presentation/input boundary; switching preferences never rewrites trips.
export function displayMoney(amount: number, target: string, locale: string, report?: ExchangeReport | null, now = Date.now()) {
  const rate = usableRate(target, report, now);
  return rate === null ? formatMoney(amount, 'USD', locale) : `${target === 'USD' ? '' : '≈ '}${formatMoney(amount * rate, target, locale)}`;
}
export function parseMoneyInput(text: string, locale: string): number {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find((p) => p.type === 'group')?.value ?? ','; const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  const normalized = text.trim().split(group).join('').split(decimal).join('.');
  return /^\d+(?:\.\d*)?$/.test(normalized) ? Number(normalized) : NaN;
}
export function moneyInputText(amount: number, rate: number, locale: string, currency: string) {
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits }).format(amount * rate);
}
