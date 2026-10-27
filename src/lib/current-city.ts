import { type HomeLocation } from './journey-types';

type Permission = { status: string; canAskAgain: boolean };
type Address = { city?: string | null; district?: string | null; country?: string | null };
export type CityStage = 'checking' | 'permission' | 'locating' | 'geocoding';
export type CityResult = { status: 'ready'; location: HomeLocation } | { status: 'permission' | 'denied' | 'services-off'; canAskAgain: boolean };
export type CityAdapter = {
  permission: () => Promise<Permission>;
  requestPermission: () => Promise<Permission>;
  servicesEnabled: () => Promise<boolean>;
  position: () => Promise<{ coords: { latitude: number; longitude: number } }>;
  reverse: (coordinates: { latitude: number; longitude: number }) => Promise<Address[]>;
};
export class CityLookupError extends Error {
  constructor(message: string, public readonly reason: 'cancelled' | 'timeout' | 'unavailable' = 'unavailable') { super(message); this.name = 'CityLookupError'; }
}
export function manualHomeLocation(city: string, country: string, now = new Date().toISOString()): HomeLocation {
  const cleaned = { city: city.trim().replace(/\s+/g, ' '), country: country.trim().replace(/\s+/g, ' ') };
  if (!cleaned.city || !cleaned.country) throw new Error('Add both your city and country.');
  if (cleaned.city.length > 100 || cleaned.country.length > 100) throw new Error('Keep the city and country within 100 characters each.');
  return { ...cleaned, source: 'manual', updatedAt: now };
}
export function validHomeLocation(value: unknown): value is HomeLocation {
  if (!value || typeof value !== 'object') return false;
  const p = value as HomeLocation;
  return typeof p.city === 'string' && !!p.city.trim() && p.city.length <= 100 && typeof p.country === 'string' && !!p.country.trim() && p.country.length <= 100 && ['device', 'manual'].includes(p.source) && typeof p.updatedAt === 'string' && Number.isFinite(Date.parse(p.updatedAt));
}
// Native GPS/geocoding promises cannot be cancelled. Stop waiting and ignore their late results.
function step<T>(operation: () => Promise<T>, signal: AbortSignal | undefined, timeoutMs: number): Promise<T> {
  if (signal?.aborted) return Promise.reject(new CityLookupError('Location lookup cancelled.', 'cancelled'));
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (value?: T, error?: unknown) => { if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); if (error) reject(error); else resolve(value as T); };
    const abort = () => finish(undefined, new CityLookupError('Location lookup cancelled.', 'cancelled'));
    const timer = setTimeout(() => finish(undefined, new CityLookupError('Finding your city is taking too long. Try again outside, or enter your city manually.', 'timeout')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => { if (signal?.aborted) throw new CityLookupError('Location lookup cancelled.', 'cancelled'); return operation(); }).then((value) => finish(value), (error) => finish(undefined, error));
  });
}
export async function resolveCurrentCity(adapter: CityAdapter, { ask = false, signal, onStage, timeoutMs = 20000 }: { ask?: boolean; signal?: AbortSignal; onStage?: (stage: CityStage) => void; timeoutMs?: number } = {}): Promise<CityResult> {
  onStage?.('checking');
  let permission = await step(adapter.permission, signal, timeoutMs);
  if (permission.status !== 'granted' && ask && permission.canAskAgain) {
    onStage?.('permission'); permission = await step(adapter.requestPermission, signal, Math.max(timeoutMs, 120000));
  }
  if (permission.status !== 'granted') return { status: permission.status === 'undetermined' ? 'permission' : 'denied', canAskAgain: permission.canAskAgain };
  if (!await step(adapter.servicesEnabled, signal, timeoutMs)) return { status: 'services-off', canAskAgain: true };
  onStage?.('locating');
  const { coords } = await step(adapter.position, signal, timeoutMs);
  if (!Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90 || !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180) throw new CityLookupError('Your device didn’t return a usable location. Try again or enter your city manually.');
  onStage?.('geocoding');
  const addresses = await step(() => adapter.reverse({ latitude: coords.latitude, longitude: coords.longitude }), signal, timeoutMs);
  for (const address of addresses) {
    // Never turn a state, street or landmark into a purported city.
    const city = address.city?.trim() || address.district?.trim(); const country = address.country?.trim();
    if (city && country) return { status: 'ready', location: { ...manualHomeLocation(city, country), source: 'device' } };
  }
  throw new CityLookupError('We found your position, but couldn’t identify its city and country. Enter them manually or try again.');
}
