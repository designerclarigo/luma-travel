import { localDate, tripDays, validDeparture } from './dates';
import { type Trip } from './travel-state';

export function nextDashboardTrip(trips: Trip[], today = localDate()): Trip | undefined {
  const eligible = trips.filter((t) => !t.completedAt && validDeparture(t.departure) && validDeparture(t.endDate) && t.endDate >= today);
  return eligible.sort((a, b) => {
    const aActive = a.departure <= today, bActive = b.departure <= today;
    return aActive !== bActive ? aActive ? -1 : 1 : a.departure.localeCompare(b.departure) || a.id.localeCompare(b.id);
  })[0];
}
export function departureCountdown(trip: Trip, today = localDate()) {
  const remaining = tripDays(today, trip.departure) - 1;
  if (remaining > 0) return `${remaining} ${remaining === 1 ? 'day' : 'days'} to go`;
  if (remaining === 0) return 'Leaving today';
  return `Day ${tripDays(trip.departure, today)} of ${tripDays(trip.departure, trip.endDate)}`;
}
