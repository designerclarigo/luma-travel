import { initialTravelState, parseTravelState, type TravelState, uniqueId, type Trip } from './travel-state';
export type PortableData = { kind: 'waylo-backup' | 'waylo-trip'; schema: 1; createdAt: string; data: TravelState };
export function exportBackup(state: TravelState): string { return JSON.stringify({ kind: 'waylo-backup', schema: 1, createdAt: new Date().toISOString(), data: { ...state, cloudLinks: [] } }, null, 2); }
export function exportTrip(state: TravelState, trip: Trip): string {
  const data = { ...initialTravelState, trips: [trip], bags: state.bags.filter((b) => trip.bagIds.includes(b.id)), customPlaces: state.customPlaces.filter((p) => trip.destinationIds.includes(p.id)), notifications: [], cloudLinks: [] };
  return JSON.stringify({ kind: 'waylo-trip', schema: 1, createdAt: new Date().toISOString(), data }, null, 2);
}
export function readPortable(raw: string): PortableData {
  if (raw.length > 5_000_000) throw new Error('This file is too large. Choose a Waylo JSON file under 5 MB.');
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error('This is not a valid JSON file. Your data has not changed.'); }
  if (!parsed || !['waylo-backup', 'waylo-trip'].includes(parsed.kind) || parsed.schema !== 1 || typeof parsed.createdAt !== 'string' || Number.isNaN(Date.parse(parsed.createdAt))) throw new Error('Choose a supported Waylo backup or trip file.');
  let data: TravelState; try { data = parseTravelState(JSON.stringify(parsed.data)); } catch { throw new Error('This export contains invalid travel data. Your saved records have not changed.'); }
  if (parsed.kind === 'waylo-trip' && data.trips.length !== 1) throw new Error('A shared trip file must contain exactly one trip.');
  return { ...parsed, data: { ...data, cloudLinks: [] } };
}
const mergeIds = <T extends { id: string }>(current: T[], incoming: T[]) => [...current, ...incoming.filter((i) => !current.some((c) => c.id === i.id))];
export function importPortable(current: TravelState, file: PortableData, includeProfile = false, id = uniqueId): TravelState {
  const incoming = file.data;
  if (file.kind === 'waylo-trip') {
    const bagMap = new Map(incoming.bags.map((b) => [b.id, id()])); const old = incoming.trips[0]; const trip: Trip = { ...old, id: id(), title: `${old.title} · imported`, bagIds: old.bagIds.flatMap((b) => bagMap.get(b) ? [bagMap.get(b)!] : []), packing: old.packing.map((p) => ({ ...p, bagId: p.bagId ? bagMap.get(p.bagId) : undefined })) };
    return { ...current, trips: [trip, ...current.trips], bags: [...current.bags, ...incoming.bags.map((b) => ({ ...b, id: bagMap.get(b.id)! }))], customPlaces: mergeIds(current.customPlaces, incoming.customPlaces) };
  }
  return { ...current, saved: [...new Set([...current.saved, ...incoming.saved])], trips: mergeIds(current.trips, incoming.trips), bags: mergeIds(current.bags, incoming.bags), templates: mergeIds(current.templates, incoming.templates), customPlaces: mergeIds(current.customPlaces, incoming.customPlaces), reviews: [...current.reviews, ...incoming.reviews.filter((r) => !current.reviews.some((c) => c.tripId === r.tripId))], passport: [...current.passport, ...incoming.passport.filter((p) => !current.passport.some((c) => c.code === p.code))], ...(includeProfile ? { profile: incoming.profile, preferences: incoming.preferences, settings: incoming.settings } : {}) };
}
export function tripSummary(trip: Trip) { return `${trip.title}\n${trip.departure} – ${trip.endDate} · ${trip.travelers} travelers\nGroup budget: USD ${trip.budget} (planning estimate)\n\n${[...trip.itinerary].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).map((e) => `Day ${e.day} · ${e.time} · ${e.title}\n${e.notes}`).join('\n\n')}\n\nPacking\n${trip.packing.map((p) => `${p.packed ? '✓' : '□'} ${p.label} × ${p.quantity ?? 1}`).join('\n')}\n\nShared from Waylo. A static copy; future edits are not synchronized.`; }
