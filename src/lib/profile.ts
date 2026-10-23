import { type TravelPreferences, type TravelState } from './travel-state';

/** Match Saved's catalog and explicitly visited passport records, without invented travel history. */
export function profileStatistics(data: TravelState, destinationIds: readonly string[]) {
  const known = new Set(destinationIds);
  return {
    trips: data.trips.length,
    saved: new Set(data.saved.filter((id) => known.has(id))).size,
    visited: new Set(data.passport.filter((country) => country.status === 'visited').map((country) => country.code)).size,
    unread: data.notifications.filter((item) => !item.read && (data.preferences.inspiration || !!item.tripId)).length,
  };
}
export function profileInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map((word) => Array.from(word)[0]).join('').toLocaleUpperCase() || 'W';
}
export function saveProfile(data: TravelState, profile: TravelState['profile']): TravelState {
  const name = profile.name.trim(); const location = profile.location.trim();
  if (!name || !location) throw new Error('Add your name and home location.');
  if (name.length > 100 || location.length > 100) throw new Error('Keep your name and location within 100 characters.');
  return { ...data, profile: { name, location } };
}
export type TravelDefaults = Pick<TravelPreferences, 'interests' | 'pace' | 'travelers'>;
export type InboxPreferences = Pick<TravelPreferences, 'tripUpdates' | 'inspiration'>;
// Each editor updates only its own fields, against the latest durable state.
export function saveTravelDefaults(data: TravelState, draft: TravelDefaults): TravelState {
  if (!Number.isInteger(draft.travelers) || draft.travelers < 1 || draft.travelers > 20) throw new Error('Choose between 1 and 20 travelers.');
  return { ...data, preferences: { ...data.preferences, interests: [...draft.interests], pace: draft.pace, travelers: draft.travelers } };
}
export function saveInboxPreferences(data: TravelState, draft: InboxPreferences): TravelState {
  return { ...data, preferences: { ...data.preferences, tripUpdates: draft.tripUpdates, inspiration: draft.inspiration } };
}
