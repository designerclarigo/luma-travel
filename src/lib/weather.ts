import climateData from '../constants/data/climate.json';
import { type Place, type Stop, type WeatherReport } from './journey-types';
export type ClimateNormal = { placeId: string; latitude: number; longitude: number; timezone: string; period: string; model: string; source: string; retrievedAt: string; url: string; months: { month: number; low: number; high: number; rainDays: number; samples: number }[] };
export const climateNormals: ClimateNormal[] = (climateData as unknown as ClimateNormal[]).filter((record) => record.months.length === 12 && record.months.every((month) => Number.isFinite(month.low) && Number.isFinite(month.high) && month.samples >= 700));
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000); const abort = () => controller.abort(); signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  try { const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(response.status === 429 ? 'The provider is busy. Please wait before trying again.' : `Provider request failed (${response.status}). Please try again.`); return await response.json(); }
  catch (error) { if (controller.signal.aborted) throw new Error('The request was cancelled or took too long. Saved data is still available.'); throw error; }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export function parseForecast(raw: unknown, place: Place, fetchedAt = new Date().toISOString()): WeatherReport {
  if (!raw || typeof raw !== 'object') throw new Error('The weather response was incomplete.');
  const value = raw as { latitude?: unknown; longitude?: unknown; timezone?: unknown; daily?: Record<string, unknown[]>; hourly?: Record<string, unknown[]> };
  if (!number(value.latitude) || !number(value.longitude) || Math.abs(value.latitude - place.latitude) > 1 || Math.abs(value.longitude - place.longitude) > 1 || typeof value.timezone !== 'string' || !Array.isArray(value.daily?.time)) throw new Error('The weather response did not match this place.');
  const d = value.daily; const h = value.hourly;
  const days = d.time.flatMap((date, index) => {
    const low = d.temperature_2m_min?.[index], high = d.temperature_2m_max?.[index];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !number(low) || !number(high) || low > high) return [];
    const probability = d.precipitation_probability_max?.[index], precipitation = d.precipitation_sum?.[index], code = d.weather_code?.[index];
    const hours = (h?.time ?? []).flatMap((time, hour) => { const temperature = h?.temperature_2m?.[hour], rain = h?.precipitation_probability?.[hour]; return typeof time === 'string' && time.startsWith(`${date}T`) && number(temperature) ? [{ time, temperature, rainProbability: number(rain) ? rain : null }] : []; });
    return [{ date, low, high, rainProbability: number(probability) ? probability : null, rainMm: number(precipitation) ? precipitation : null, code: number(code) ? code : null, hours }];
  });
  if (!days.length) throw new Error('No usable forecast dates were returned.');
  return { placeId: place.id, latitude: value.latitude, longitude: value.longitude, timezone: value.timezone, fetchedAt, days, kind: 'forecast', source: 'Open-Meteo' };
}
export async function fetchForecast(place: Place, signal?: AbortSignal) {
  const query = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), timezone: place.timezone || 'auto', forecast_days: '16', temperature_unit: 'celsius', precipitation_unit: 'mm', timeformat: 'iso8601', daily: 'temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum,weather_code', hourly: 'temperature_2m,precipitation_probability' });
  return parseForecast(await fetchJson(`https://api.open-meteo.com/v1/forecast?${query}`, signal), place);
}
export function climateForStop(stop: Stop) {
  const normal = climateNormals.find((item) => item.placeId === stop.place.id); if (!normal) return null;
  const months = new Set<number>(); const current = new Date(`${stop.arrival}T12:00:00Z`); const end = new Date(`${stop.departure}T12:00:00Z`);
  for (let day = 0; current <= end && day < 366; day++, current.setUTCDate(current.getUTCDate() + 1)) months.add(current.getUTCMonth() + 1);
  return { ...normal, months: normal.months.filter((item) => months.has(item.month)) };
}
export function cacheIsFresh(report: WeatherReport, now = Date.now()) { const age = now - Date.parse(report.fetchedAt); return age >= -300000 && age < 6 * 3600000; }
export function temperatureLabel(value: number, unit: 'C' | 'F') { return `${Math.round(unit === 'F' ? value * 9 / 5 + 32 : value)}°${unit}`; }
