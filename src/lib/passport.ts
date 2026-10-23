import { catalogPlaces } from '@/constants/places';
import { canonical, packingContext } from './packing-engine';
import { localDate, type TravelState } from './travel-state';
export function completeJourney(state: TravelState, tripId: string, unusedItemIds: string[], now = new Date().toISOString()): TravelState {
  const trip = state.trips.find((t) => t.id === tripId); if (!trip) throw new Error('This trip is no longer saved.');
  if (trip.endDate > localDate(new Date(now))) throw new Error('Complete this journey after its return date.');
  const codes = [...new Set((trip.stops.length ? trip.stops.map((s) => s.place) : trip.destinationIds.map((id) => catalogPlaces.find((p) => p.id === id) ?? state.customPlaces.find((p) => p.id === id))).filter((p) => !!p).map((p) => p!.countryCode))];
  const passport = [...state.passport]; for (const code of codes) { const index = passport.findIndex((p) => p.code === code); const existing = passport[index]; const record = { code, status: 'visited' as const, visitedOn: existing?.visitedOn || trip.endDate, note: existing?.note ?? '', regions: existing?.regions ?? [], manual: existing?.manual ?? false, manualStatus: existing?.manualStatus ?? (existing?.manual ? existing.status : undefined), sourceTripIds: [...new Set([...(existing?.sourceTripIds ?? []), tripId])] }; if (index < 0) passport.push(record); else passport[index] = record; }
  const review = { tripId, context: packingContext(trip), unusedKeys: [...new Set(trip.packing.filter((i) => unusedItemIds.includes(i.id)).map((i) => canonical(i.label)))], reviewedAt: now };
  return { ...state, passport, trips: state.trips.map((t) => t.id === tripId ? { ...t, completedAt: now } : t), reviews: [...state.reviews.filter((r) => r.tripId !== tripId), review] };
}
export function reopenJourney(state: TravelState, tripId: string): TravelState {
  return { ...state, trips: state.trips.map((t) => t.id === tripId ? { ...t, completedAt: null } : t), reviews: state.reviews.filter((r) => r.tripId !== tripId), passport: state.passport.map((p) => ({ ...p, sourceTripIds: p.sourceTripIds.filter((id) => id !== tripId) })).filter((p) => p.manual || p.sourceTripIds.length > 0).map((p) => p.manual && !p.sourceTripIds.length ? { ...p, status: p.manualStatus ?? p.status } : p) };
}
