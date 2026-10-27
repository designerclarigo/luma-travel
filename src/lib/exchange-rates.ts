import { exchangeCacheKey, ratesAreFresh, validExchangeReport, type ExchangeReport } from './money';
export const exchangeEndpoint = 'https://open.er-api.com/v6/latest/USD';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
export function parseExchangeResponse(value: unknown, now = Date.now()): ExchangeReport {
  if (!value || typeof value !== 'object') throw new Error('The exchange-rate service returned invalid data.');
  const data = value as Record<string, unknown>;
  const report = { source: 'ExchangeRate-API' as const, base: 'USD' as const, updatedAt: Number(data.time_last_update_unix) * 1000, nextUpdate: Number(data.time_next_update_unix) * 1000, fetchedAt: now, rates: data.rates as Record<string, number> };
  if (data.result !== 'success' || data.base_code !== 'USD' || !validExchangeReport(report, now)) throw new Error('Valid USD exchange rates were not returned. Original amounts are unchanged.');
  return report;
}
export function createExchangeStore(storage: Storage, request: typeof fetch = fetch, clock: () => number = Date.now) {
  let report: ExchangeReport | null = null; let pending: Promise<ExchangeReport> | null = null;
  return {
    async load() { try { const raw = await storage.getItem(exchangeCacheKey); const parsed: unknown = raw ? JSON.parse(raw) : null; report = validExchangeReport(parsed, clock()) ? parsed : null; } catch { report = null; } return report; },
    refresh(force = false): Promise<ExchangeReport> {
      if (pending) return pending;
      if (report && (clock() - report.fetchedAt < 3600000 || !force && ratesAreFresh(report, clock()))) return Promise.resolve(report);
      pending = (async () => {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const response = await request(exchangeEndpoint, { signal: controller.signal });
          if (!response.ok) throw new Error(response.status === 429 ? 'The rate service is busy. Retry later; original amounts are safe.' : `Exchange rates are unavailable (${response.status}).`);
          const next = parseExchangeResponse(await response.json(), clock());
          await storage.setItem(exchangeCacheKey, JSON.stringify(next)); report = next; return next;
        } catch (cause) { if (controller.signal.aborted) throw new Error('The exchange-rate request timed out. Saved rates or original USD amounts remain available.'); throw cause; }
        finally { clearTimeout(timeout); pending = null; }
      })(); return pending;
    },
  };
}
