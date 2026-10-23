import { addDays, dateLabel, localDate, tripDays, validDeparture } from './dates';
import { baseCategories, defaultPackingOptions, defaultSettings, type AppSettings, type Bag, type CloudLink, type CountryRecord, type PackingCategory, type PackingOptions, type PackingTemplate, type Place, type Stop, type UsageReview, type WeatherReport } from './journey-types';
import { regeneratePacking } from './packing-engine';
import { type BagLimit } from './bag-fit';
import { catalogPlaces } from '@/constants/places';
import { validateStops } from './route-planning';

export { addDays, dateLabel, localDate, tripDays, validDeparture } from './dates';
export type Filters = { category: string; budget: number | null; highlyRated: boolean; minRating?: number };
export const defaultFilters: Filters = { category: 'All', budget: null, highlyRated: false };
export type SortOrder = 'recommended' | 'price' | 'rating';
export type PackingItem = { id: string; label: string; packed: boolean; packedCount?: number; quantity?: number; categoryId?: string; ownerId?: string; notes?: string; essential?: boolean; sourceKey?: string; edited?: boolean; overrides?: string[]; reason?: string; bagId?: string; unitWeightGrams?: number; retired?: boolean };
export type ItineraryEntry = { id: string; day: number; destinationId: string; title: string; time: string; notes: string; cost: number; activity?: string; packForActivity?: boolean; address?: string; latitude?: number; longitude?: number };
export type Trip = { id: string; destinationId: string; destinationIds: string[]; title: string; departure: string; endDate: string; travelers: number; budget: number; interests: string[]; itinerary: ItineraryEntry[]; packing: PackingItem[]; starterDetails?: boolean; packingOptions: PackingOptions; packingCategories: PackingCategory[]; excludedRules: string[]; packingGenerated: boolean; stops: Stop[]; bagIds: string[]; airlineId: string; bagLimits?: Partial<Record<Bag['type'], BagLimit>>; completedAt: string | null; departureTime: string };
export type TravelPreferences = { interests: string[]; pace: 'Relaxed' | 'Balanced' | 'Adventurous'; travelers: number; tripUpdates: boolean; inspiration: boolean };
export type TravelNotification = { id: string; title: string; body: string; createdAt: string; read: boolean; tripId?: string };
export type TravelState = { version: 3; saved: string[]; profile: { name: string; location: string }; trips: Trip[]; notificationsRead: boolean; notifications: TravelNotification[]; preferences: TravelPreferences; recentSearches: string[]; bags: Bag[]; templates: PackingTemplate[]; passport: CountryRecord[]; reviews: UsageReview[]; settings: AppSettings; weatherCache: WeatherReport[]; customPlaces: Place[]; cloudLinks: CloudLink[] };
// Retain the original key; upgrade old data only on a successful write.
export const travelStorageKey = '@waylo/travel-state/v1';
export const defaultPreferences: TravelPreferences = { interests: ['Nature'], pace: 'Balanced', travelers: 2, tripUpdates: true, inspiration: true };
const welcome: TravelNotification = { id: 'welcome', title: 'Your next chapter is waiting.', body: 'Save a place that speaks to you, then turn a little inspiration into a plan.', createdAt: new Date().toISOString(), read: false };
export const initialTravelState: TravelState = { version: 3, saved: [], profile: { name: 'Alex Morgan', location: 'Mumbai, India' }, trips: [], notificationsRead: false, notifications: [welcome], preferences: defaultPreferences, recentSearches: [], bags: [], templates: [], passport: [], reviews: [], settings: defaultSettings, weatherCache: [], customPlaces: [], cloudLinks: [] };
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const invalid = () => { throw new Error('Invalid saved travel data. Your original data has not been changed.'); };
export const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function parseTravelState(raw: string | null): TravelState {
  if (raw === null) return JSON.parse(JSON.stringify(initialTravelState));
  const value = JSON.parse(raw);
  if (!value || ![1, 2, 3].includes(value.version) || !strings(value.saved) || !value.profile || typeof value.profile.name !== 'string' || typeof value.profile.location !== 'string' || !Array.isArray(value.trips) || typeof value.notificationsRead !== 'boolean') return invalid();
  const trips: Trip[] = value.trips.map((trip: Trip) => {
    if (!trip || typeof trip.id !== 'string' || typeof trip.destinationId !== 'string' || typeof trip.title !== 'string' || !validDeparture(trip.departure) || !Array.isArray(trip.packing) || !trip.packing.every((item) => item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.packed === 'boolean')) return invalid();
    if (value.version === 1) return upgradeTrip({ ...trip, destinationIds: [trip.destinationId], endDate: addDays(trip.departure, 3), travelers: 2, budget: 1000, interests: [], itinerary: [], starterDetails: true });
    if (!strings(trip.destinationIds) || !validDeparture(trip.endDate) || !Number.isInteger(trip.travelers) || trip.travelers < 1 || !finite(trip.budget) || trip.budget < 0 || !strings(trip.interests) || !Array.isArray(trip.itinerary)) return invalid();
    for (const entry of trip.itinerary) if (!entry || typeof entry.id !== 'string' || !Number.isInteger(entry.day) || entry.day < 1 || entry.day > tripDays(trip.departure, trip.endDate) || typeof entry.destinationId !== 'string' || typeof entry.title !== 'string' || typeof entry.time !== 'string' || typeof entry.notes !== 'string' || !finite(entry.cost) || entry.cost < 0) return invalid();
    if (tripDays(trip.departure, trip.endDate) < 1 || tripDays(trip.departure, trip.endDate) > 366) return invalid();
    if (value.version === 3) validateExpansionTrip(trip);
    return value.version < 3 ? upgradeTrip(trip) : trip;
  });
  if (value.version === 1) return { ...JSON.parse(JSON.stringify(initialTravelState)), saved: [...new Set<string>(value.saved)], profile: value.profile, trips, notificationsRead: value.notificationsRead, notifications: [{ ...welcome, read: value.notificationsRead }] };
  const p = value.preferences;
  if (!p || !strings(p.interests) || !['Relaxed', 'Balanced', 'Adventurous'].includes(p.pace) || !Number.isInteger(p.travelers) || p.travelers < 1 || typeof p.tripUpdates !== 'boolean' || typeof p.inspiration !== 'boolean' || !strings(value.recentSearches) || !Array.isArray(value.notifications)) return invalid();
  for (const n of value.notifications) if (!n || typeof n.id !== 'string' || typeof n.title !== 'string' || typeof n.body !== 'string' || typeof n.createdAt !== 'string' || Number.isNaN(Date.parse(n.createdAt)) || typeof n.read !== 'boolean' || (n.tripId !== undefined && typeof n.tripId !== 'string')) return invalid();
  if (value.version === 3) validateExpansionState(value);
  return { ...JSON.parse(JSON.stringify(initialTravelState)), ...value, version: 3, saved: [...new Set<string>(value.saved)], trips, notificationsRead: value.notifications.every((n: TravelNotification) => n.read) };
}

type OriginalTrip = Pick<Trip, 'id' | 'destinationId' | 'destinationIds' | 'title' | 'departure' | 'endDate' | 'travelers' | 'budget' | 'interests' | 'itinerary' | 'packing' | 'starterDetails'>;
function upgradeTrip(trip: OriginalTrip): Trip { return { ...trip, packingOptions: defaultPackingOptions(trip.travelers), packingCategories: baseCategories.map((item) => ({ ...item })), excludedRules: [], packingGenerated: false, stops: [], bagIds: [], airlineId: '', completedAt: null, departureTime: '', packing: trip.packing.map((item) => ({ ...item, quantity: item.quantity ?? 1, packedCount: item.packed ? item.quantity ?? 1 : 0, categoryId: item.categoryId ?? 'extras', ownerId: item.ownerId ?? 'adult-0', notes: item.notes ?? '', essential: item.essential ?? false, edited: true })) }; }
export function validatePlace(place: Place) { if (!place || typeof place.id !== 'string' || typeof place.name !== 'string' || typeof place.country !== 'string' || !/^[A-Z]{2}$/.test(place.countryCode) || !finite(place.latitude) || Math.abs(place.latitude) > 90 || !finite(place.longitude) || Math.abs(place.longitude) > 180 || typeof place.timezone !== 'string' || !['catalog', 'geonames', 'manual'].includes(place.source) || (place.kind !== undefined && !['city', 'country', 'region'].includes(place.kind))) return invalid(); }
function validateExpansionTrip(trip: Trip) {
  const o = trip.packingOptions;
  if (!o || !(o.laundryEvery === null || Number.isInteger(o.laundryEvery) && o.laundryEvery > 0 && o.laundryEvery <= 366) || !['light', 'balanced', 'generous'].includes(o.luggage) || !['leisure', 'business', 'cruise'].includes(o.type) || !['fly', 'drive', 'rail', 'sea'].includes(o.transport) || !['auto', 'yes', 'no'].includes(o.international) || typeof o.homeCountry !== 'string' || !['auto', 'hot', 'mild', 'cold', 'mixed'].includes(o.climate) || !['auto', 'yes', 'no'].includes(o.rain) || !Number.isInteger(o.formalNights) || o.formalNights < 0 || o.formalNights > 366 || typeof o.themeNights !== 'string' || typeof o.cruiseLine !== 'string' || !Array.isArray(o.people) || o.people.length < 1 || o.people.length > 20 || !o.people.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && (p.age === null || Number.isInteger(p.age) && p.age >= 0 && p.age <= 120) && (p.diapers === undefined || typeof p.diapers === 'boolean'))) return invalid();
  if (!Array.isArray(trip.packingCategories) || !trip.packingCategories.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string') || !strings(trip.excludedRules) || typeof trip.packingGenerated !== 'boolean' || !Array.isArray(trip.stops) || !strings(trip.bagIds) || typeof trip.airlineId !== 'string' || !(trip.completedAt === null || typeof trip.completedAt === 'string' && !Number.isNaN(Date.parse(trip.completedAt))) || typeof trip.departureTime !== 'string') return invalid();
  for (const stop of trip.stops) { if (!stop || typeof stop.id !== 'string' || !validDeparture(stop.arrival) || !validDeparture(stop.departure) || stop.departure < stop.arrival) return invalid(); validatePlace(stop.place); }
  for (const item of trip.packing) if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) || item.packedCount !== undefined && (!Number.isInteger(item.packedCount) || item.packedCount < 0 || item.packedCount > (item.quantity ?? 1)) || ['categoryId', 'ownerId', 'notes', 'sourceKey', 'reason', 'bagId'].some((key) => item[key as keyof PackingItem] !== undefined && typeof item[key as keyof PackingItem] !== 'string') || ['essential', 'edited', 'retired'].some((key) => item[key as keyof PackingItem] !== undefined && typeof item[key as keyof PackingItem] !== 'boolean') || item.unitWeightGrams !== undefined && (!finite(item.unitWeightGrams) || item.unitWeightGrams < 0)) return invalid();
  for (const item of trip.packing) if (item.overrides !== undefined && !strings(item.overrides)) return invalid();
  if (trip.bagLimits !== undefined) for (const [key, limit] of Object.entries(trip.bagLimits)) if (!['personal', 'cabin', 'checked'].includes(key) || !limit || !(limit.dimensions === null || Array.isArray(limit.dimensions) && limit.dimensions.length === 3 && limit.dimensions.every((n) => finite(n) && n > 0 && n <= 400)) || !(limit.linearCm === null || finite(limit.linearCm) && limit.linearCm > 0) || !(limit.maxKg === null || finite(limit.maxKg) && limit.maxKg > 0) || !(limit.allowed === null || typeof limit.allowed === 'boolean')) return invalid();
  for (const entry of trip.itinerary) if (entry.activity !== undefined && typeof entry.activity !== 'string' || entry.packForActivity !== undefined && typeof entry.packForActivity !== 'boolean' || entry.latitude !== undefined && (!finite(entry.latitude) || Math.abs(entry.latitude) > 90) || entry.longitude !== undefined && (!finite(entry.longitude) || Math.abs(entry.longitude) > 180)) return invalid();
  for (const list of [trip.packingOptions.people, trip.packingCategories, trip.packing, trip.stops, trip.itinerary]) if (new Set(list.map((item) => item.id)).size !== list.length) return invalid();
  if (!trip.packingCategories.some((c) => c.id === 'extras') || trip.packing.some((i) => i.categoryId !== undefined && !trip.packingCategories.some((c) => c.id === i.categoryId))) return invalid();
  if (trip.stops.length && (trip.stops.some((s) => !trip.destinationIds.includes(s.place.id)) || validateStops(trip.stops, trip))) return invalid();
}
function validateExpansionState(value: TravelState) {
  if (value.settings?.hapticsEnabled !== undefined && typeof value.settings.hapticsEnabled !== 'boolean') return invalid();
  if (!Array.isArray(value.bags) || !Array.isArray(value.templates) || !Array.isArray(value.passport) || !Array.isArray(value.reviews) || !Array.isArray(value.weatherCache) || !Array.isArray(value.customPlaces) || !Array.isArray(value.cloudLinks) || !value.settings || !['en', 'es', 'hi'].includes(value.settings.language) || !['C', 'F'].includes(value.settings.temperature) || !['kg', 'lb'].includes(value.settings.weight) || typeof value.settings.weatherEnabled !== 'boolean' || typeof value.settings.widgetsEnabled !== 'boolean') return invalid();
  for (const b of value.bags) if (!b || typeof b.id !== 'string' || typeof b.name !== 'string' || !['personal', 'cabin', 'checked'].includes(b.type) || ![b.length, b.width, b.depth].every((n) => finite(n) && n > 0 && n <= 400) || !(b.measuredKg === null || finite(b.measuredKg) && b.measuredKg >= 0) || !(b.tareKg === null || finite(b.tareKg) && b.tareKg >= 0)) return invalid();
  for (const t of value.templates) if (!t || typeof t.id !== 'string' || typeof t.name !== 'string' || !Array.isArray(t.categories) || !t.categories.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string') || !Array.isArray(t.items) || !t.items.every((i) => i && typeof i.label === 'string' && typeof i.categoryId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 9999 && typeof i.notes === 'string' && typeof i.essential === 'boolean')) return invalid();
  for (const c of value.passport) if (!c || !/^[A-Z]{2}$/.test(c.code) || !['visited', 'wishlist'].includes(c.status) || typeof c.visitedOn !== 'string' || typeof c.note !== 'string' || !strings(c.regions) || !strings(c.sourceTripIds) || typeof c.manual !== 'boolean') return invalid();
  for (const r of value.reviews) if (!r || typeof r.tripId !== 'string' || typeof r.context !== 'string' || !strings(r.unusedKeys) || typeof r.reviewedAt !== 'string') return invalid();
  for (const p of value.customPlaces) validatePlace(p);
  for (const w of value.weatherCache) if (!w || typeof w.placeId !== 'string' || w.source !== 'Open-Meteo' || w.kind !== 'forecast' || !finite(w.latitude) || !finite(w.longitude) || typeof w.timezone !== 'string' || Number.isNaN(Date.parse(w.fetchedAt)) || !Array.isArray(w.days) || !w.days.every((d) => d && validDeparture(d.date) && finite(d.low) && finite(d.high) && d.low <= d.high && (d.rainProbability === null || finite(d.rainProbability)) && (d.rainMm === null || finite(d.rainMm)) && Array.isArray(d.hours) && d.hours.every((h) => h && typeof h.time === 'string' && finite(h.temperature) && (h.rainProbability === null || finite(h.rainProbability))))) return invalid();
  for (const c of value.cloudLinks) if (!c || typeof c.tripId !== 'string' || typeof c.roomId !== 'string' || !Number.isInteger(c.revision) || c.revision < 0 || typeof c.signature !== 'string') return invalid();
  for (const c of value.cloudLinks) if (c.userId !== undefined && typeof c.userId !== 'string') return invalid();
  for (const c of value.passport) if (c.manualStatus !== undefined && !['visited', 'wishlist'].includes(c.manualStatus)) return invalid();
  for (const list of [value.trips, value.bags, value.templates, value.customPlaces]) if (new Set(list.map((item) => item.id)).size !== list.length) return invalid();
}

type Searchable = { name: string; country: string; region: string; keywords: string; categories: readonly string[]; price: number; rating: number };
export function filterDestinations<T extends Searchable>(places: readonly T[], query: string, filters: Filters): T[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return places.filter((place) => {
    const text = `${place.name} ${place.country} ${place.region} ${place.keywords} ${place.categories.join(' ')}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word)) && (filters.category === 'All' || place.categories.includes(filters.category)) && (filters.budget === null || place.price <= filters.budget) && place.rating >= (filters.minRating ?? (filters.highlyRated ? 4.9 : 0));
  });
}
export function sortDestinations<T extends Searchable>(places: readonly T[], order: SortOrder): T[] { return [...places].sort((a, b) => order === 'price' ? a.price - b.price : order === 'rating' ? b.rating - a.rating : 0); }
export function rememberSearch(value: TravelState, query: string): TravelState { const text = query.trim().slice(0, 100); return text ? { ...value, recentSearches: [text, ...value.recentSearches.filter((item) => item.toLocaleLowerCase() !== text.toLocaleLowerCase())].slice(0, 8) } : value; }
export function createTrip(destinationId: string, title: string, departure: string): Trip {
  if (!destinationId || !title.trim() || !validDeparture(departure)) throw new Error('Add a trip name and a valid departure date (YYYY-MM-DD).');
  if (departure < localDate()) throw new Error('Choose today or a future departure date.');
  return regeneratePacking(upgradeTrip({ id: uniqueId(), destinationId, destinationIds: [destinationId], title: title.trim(), departure, endDate: addDays(departure, 3), travelers: 2, budget: 1000, interests: [], itinerary: [], packing: [] }));
}
export function validateTrip(trip: Trip, editing = false): string | null {
  if (!trip.title.trim()) return 'Give your trip a name.';
  if (!trip.destinationIds.length) return 'Choose at least one destination.';
  if (!validDeparture(trip.departure) || !validDeparture(trip.endDate)) return 'Choose valid start and end dates.';
  if (!editing && trip.departure < localDate()) return 'Choose today or a future departure date.';
  const days = tripDays(trip.departure, trip.endDate);
  if (days < 1) return 'Your return date must be on or after departure.';
  if (days > 366) return 'Keep each itinerary within one year.';
  if (!Number.isInteger(trip.travelers) || trip.travelers < 1 || trip.travelers > 20) return 'Choose between 1 and 20 travelers.';
  if (trip.packingOptions.people.filter((person) => person.age !== null && person.age < 18).length > trip.travelers) return 'Remove children in Packing preferences before reducing the traveler count below your family size.';
  if (!Number.isFinite(trip.budget) || trip.budget < 0) return 'Enter a valid total budget in USD.';
  if (trip.itinerary.some((entry) => entry.day > days || entry.day < 1)) return 'Move or remove activities outside your new dates before saving.';
  if (trip.itinerary.some((entry) => !trip.destinationIds.includes(entry.destinationId))) return 'Move or remove activities for destinations you removed.';
  if (trip.itinerary.some((entry) => !entry.title.trim() || !Number.isFinite(entry.cost) || entry.cost < 0 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))) return 'Each activity needs a name, a valid time (HH:MM) and a non-negative cost.';
  if (trip.stops.length) return validateStops(trip.stops, trip);
  return null;
}
export function saveTrip(value: TravelState, trip: Trip): TravelState {
  const existing = value.trips.find((item) => item.id === trip.id);
  const error = validateTrip(trip, !!existing); if (error) throw new Error(error);
  const place = catalogPlaces.find((p) => p.id === trip.destinationIds[0]) ?? value.customPlaces.find((p) => p.id === trip.destinationIds[0]);
  const preserved = { ...trip, title: trip.title.trim(), destinationId: trip.destinationIds[0], packing: existing?.packing ?? trip.packing, stops: !trip.stops.length && trip.destinationIds.length === 1 && place ? [{ id: uniqueId(), place, arrival: trip.departure, departure: trip.endDate }] : trip.stops, starterDetails: false };
  const next = preserved.packingGenerated ? regeneratePacking(preserved, value.weatherCache, value.reviews) : preserved;
  const notification: TravelNotification = { id: uniqueId(), title: existing ? 'Your escape, refined.' : 'A new story is taking shape.', body: `${next.title} · ${dateLabel(next.departure)}`, createdAt: new Date().toISOString(), read: false, tripId: next.id };
  const notifications = value.preferences.tripUpdates ? [notification, ...value.notifications].slice(0, 50) : value.notifications;
  return { ...value, trips: existing ? value.trips.map((item) => item.id === next.id ? next : item) : [next, ...value.trips], notifications, notificationsRead: notifications.every((item) => item.read) };
}
export function markNotificationsRead(value: TravelState, id?: string): TravelState { const notifications = value.notifications.map((item) => !id || item.id === id ? { ...item, read: true } : item); return { ...value, notifications, notificationsRead: notifications.every((item) => item.read) }; }
type TravelStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
/** Serialize against the latest durable state; failed writes never replace it. */
export function createTravelStore(storage: TravelStorage) {
  let current: TravelState | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async load() { current = parseTravelState(await storage.getItem(travelStorageKey)); return current; },
    update(change: (value: TravelState) => TravelState): Promise<TravelState> {
      const operation = queue.then(async () => { if (!current) throw new Error('Travel data has not loaded.'); const next = change(current); const serialized = JSON.stringify(next); parseTravelState(serialized); await storage.setItem(travelStorageKey, serialized); current = next; return next; });
      queue = operation.catch(() => {}); return operation;
    },
  };
}
