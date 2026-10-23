import { type Stop } from './journey-types';
import { type Trip } from './travel-state';
import { validDeparture } from './dates';
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
