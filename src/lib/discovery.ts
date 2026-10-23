import { type NearbyPlace, type Place } from './journey-types';
import { fetchJson } from './weather';
export async function searchPlaces(query: string, language = 'en', signal?: AbortSignal): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  const parameters = new URLSearchParams({ name: query.trim().slice(0, 100), count: '12', language, format: 'json' });
  const raw = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`, signal) as { results?: unknown[] };
  return parsePlaces(raw);
}
export function parsePlaces(raw: unknown): Place[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || 'error' in raw || ('results' in raw && !Array.isArray(raw.results))) throw new Error('The location response was incomplete. Please try again.');
  const values = (raw as { results?: unknown[] }).results ?? [];
  const places: Place[] = []; const seen = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const p = value as Record<string, unknown>;
    if (!Number.isSafeInteger(p.id) || (p.id as number) <= 0 || typeof p.name !== 'string' || !p.name.trim() || typeof p.latitude !== 'number' || !Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 || typeof p.longitude !== 'number' || !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 || typeof p.country_code !== 'string' || !/^[A-Z]{2}$/.test(p.country_code)) continue;
    const id = `geo-${p.id}`; if (seen.has(id)) continue; seen.add(id);
    const feature = typeof p.feature_code === 'string' ? p.feature_code : '';
    places.push({ id, name: p.name.trim(), country: typeof p.country === 'string' && p.country ? p.country : p.country_code, countryCode: p.country_code, latitude: p.latitude, longitude: p.longitude, timezone: typeof p.timezone === 'string' && p.timezone ? p.timezone : 'auto', region: [...new Set([p.admin1, p.admin2].filter((x): x is string => typeof x === 'string' && !!x && x !== p.name))].join(' · '), kind: feature.startsWith('PCL') ? 'country' : feature.startsWith('ADM') ? 'region' : 'city', source: 'geonames' });
  }
  if (values.length && !places.length) throw new Error('No usable locations were returned. Please try again.');
  return places;
}
const nearbyTags: Record<string, string> = { Food: 'amenity~"restaurant|fast_food"', Coffee: 'amenity="cafe"', Museums: 'tourism="museum"', Sights: 'tourism~"attraction|viewpoint"', Parks: 'leisure="park"', Beaches: 'natural="beach"', Trails: 'highway="path"' };
export async function nearbyPlaces(latitude: number, longitude: number, category: string, signal?: AbortSignal): Promise<NearbyPlace[]> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !nearbyTags[category]) throw new Error('Choose a place and category first.');
  const query = `[out:json][timeout:20];nwr(around:2000,${latitude},${longitude})[${nearbyTags[category]}][name];out center 40;`;
  const raw = await fetchJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, signal) as { elements?: unknown[] };
  if (!Array.isArray(raw.elements)) throw new Error('No usable place response was returned.');
  return raw.elements.flatMap((value) => { const item = value as { id?: number; type?: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }; const lat = item.lat ?? item.center?.lat, lon = item.lon ?? item.center?.lon, tags = item.tags; if (typeof item.id !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || !tags?.name) return []; return [{ id: `osm-${item.type}-${item.id}`, name: tags.name, latitude: lat!, longitude: lon!, category, address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' '), website: tags.website ?? tags['contact:website'] ?? '', phone: tags.phone ?? tags['contact:phone'] ?? '', openingHours: tags.opening_hours ?? '', source: 'OpenStreetMap' as const }]; });
}
