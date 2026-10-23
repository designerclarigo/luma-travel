import { catalogPlaces } from '@/constants/places';
import { type Place } from './journey-types';
import { localDate, type Trip } from './travel-state';

export function tripPlaces(trip: Trip, places: Place[]): Place[] {
  return trip.destinationIds.flatMap((id) => { const place = trip.stops.find((s) => s.place.id === id)?.place ?? catalogPlaces.find((p) => p.id === id) ?? places.find((p) => p.id === id); return place ? [place] : []; });
}
export function tripStatus(trip: Trip, today = localDate()): 'Completed' | 'Past' | 'In progress' | 'Upcoming' {
  return trip.completedAt ? 'Completed' : trip.endDate < today ? 'Past' : trip.departure <= today ? 'In progress' : 'Upcoming';
}
