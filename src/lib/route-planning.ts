import { type Stop } from './journey-types';
import { type ItineraryEntry, type Trip } from './travel-state';
import { addDays, tripDays, validDeparture } from './dates';
export function validateStops(stops: Stop[], trip: Trip): string | null {
  if (!stops.length) return 'Add at least one stop.';
  const ordered = [...stops].sort((a, b) => a.arrival.localeCompare(b.arrival));
  for (let index = 0; index < ordered.length; index++) {
    const stop = ordered[index];
    if (!validDeparture(stop.arrival) || !validDeparture(stop.departure) || stop.arrival > stop.departure) return 'Every stop needs a valid first and last day.';
    if (stop.arrival < trip.departure || stop.departure > trip.endDate) return 'Keep all stop dates within your trip dates.';
    if (index > 0 && ordered[index - 1].departure > stop.arrival) return 'Stops can share a travel day, but cannot overlap for several days.';
  }
  if (ordered[0].arrival !== trip.departure || ordered.at(-1)!.departure !== trip.endDate) return 'Your route should cover the first and last day of the trip.';
  for (let index = 1; index < ordered.length; index++) if ((Date.parse(ordered[index].arrival) - Date.parse(ordered[index - 1].departure)) / 86400000 > 1) return 'Fill the gap between stops, or extend a stop to include your travel days.';
  for (const entry of trip.itinerary) {
    const date = new Date(`${trip.departure}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + entry.day - 1); const day = date.toISOString().slice(0, 10);
    if (!stops.some((stop) => stop.place.id === entry.destinationId && day >= stop.arrival && day <= stop.departure)) return `Move “${entry.title}” to a day when you are at its destination before saving this route.`;
  }
  return null;
}

export const stopNights = (stop: Stop) => validDeparture(stop.arrival) && validDeparture(stop.departure) ? Math.max(0, tripDays(stop.arrival, stop.departure) - 1) : 0;
export type RouteIssue = { stopId: string | null; message: string };
export function routeIssues(stops: Stop[], trip: Trip): RouteIssue[] {
  const issues: RouteIssue[] = [];
  const add = (stopId: string | null, message: string) => { if (!issues.some((p) => p.stopId === stopId && p.message === message)) issues.push({ stopId, message }); };
  if (!validDeparture(trip.departure) || !validDeparture(trip.endDate) || trip.endDate < trip.departure) return [{ stopId: null, message: 'Choose valid trip dates with the last day on or after the first day.' }];
  if (!stops.length) return [{ stopId: null, message: 'Add at least one destination to your route.' }];
  stops.forEach((stop, index) => {
    if (!validDeparture(stop.arrival) || !validDeparture(stop.departure) || stop.departure < stop.arrival) { add(stop.id, 'Choose valid dates with departure on or after arrival.'); return; }
    if (stop.arrival < trip.departure || stop.departure > trip.endDate) add(stop.id, 'These dates fall outside your trip. Adjust the stop or the trip dates.');
    const previous = stops[index - 1];
    if (previous && validDeparture(previous.departure)) {
      if (previous.departure > stop.arrival) { add(previous.id, `Dates overlap with ${stop.place.name}. Only one shared travel day is allowed.`); add(stop.id, `This stop starts before ${previous.place.name} ends.`); }
      else if (tripDays(previous.departure, stop.arrival) > 2) add(stop.id, `There are unplanned days after ${previous.place.name}. Extend a stop to cover the gap.`);
    }
  });
  if (stops[0].arrival !== trip.departure) add(stops[0].id, 'Your first destination should start on the trip’s first day.');
  if (stops.at(-1)!.departure !== trip.endDate) add(stops.at(-1)!.id, 'Your last destination should end on the trip’s last day.');
  for (const entry of trip.itinerary) {
    const date = addDays(trip.departure, entry.day - 1);
    if (!stops.some((stop) => stop.place.id === entry.destinationId && date >= stop.arrival && date <= stop.departure)) add(stops.find((s) => s.place.id === entry.destinationId)?.id ?? null, `“${entry.title}” is outside its destination’s dates. Adjust the stop or review the activity in your planner.`);
  }
  return issues;
}

/** Reflow a valid route while keeping stay lengths, shared travel days and activity offsets. */
export function moveRouteStop(stops: Stop[], from: number, to: number, trip: Trip): { stops: Stop[]; itinerary: ItineraryEntry[] } {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= stops.length || to >= stops.length) throw new Error('Choose an existing destination to move.');
  if (routeIssues(stops, trip).length) throw new Error('Resolve the date and activity warnings before reordering stops.');
  const ordered = [...stops]; const [moved] = ordered.splice(from, 1); ordered.splice(to, 0, moved);
  let cursor = trip.departure;
  const next = ordered.map((stop, index) => {
    const arrival = cursor; const departure = addDays(arrival, stopNights(stop));
    const gap = index < stops.length - 1 ? tripDays(stops[index].departure, stops[index + 1].arrival) - 1 : 0;
    cursor = addDays(departure, gap); return { ...stop, arrival, departure };
  });
  const itinerary = trip.itinerary.map((entry) => {
    const date = addDays(trip.departure, entry.day - 1);
    const before = stops.find((s) => s.place.id === entry.destinationId && date >= s.arrival && date <= s.departure)!;
    const after = next.find((s) => s.id === before.id)!;
    return { ...entry, day: tripDays(trip.departure, addDays(after.arrival, tripDays(before.arrival, date) - 1)) };
  });
  const error = validateStops(next, { ...trip, itinerary }); if (error) throw new Error(error);
  return { stops: next, itinerary };
}
