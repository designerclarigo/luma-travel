import { searchPlaces } from './discovery';
import { type Place } from './journey-types';

export type PlaceSearchState = { query: string; status: 'idle' | 'loading' | 'success' | 'error'; places: Place[]; error: string };
// Cancelling suppresses late responses even if a provider ignores abort.
export function startPlaceSearch(query: string, language: string, receive: (state: PlaceSearchState) => void, search = searchPlaces, delay = 350) {
  const text = query.trim(); const controller = new AbortController(); let active = true;
  const publish = (state: Omit<PlaceSearchState, 'query'>) => { if (active) receive({ query: text, ...state }); };
  publish({ status: text.length < 2 ? 'idle' : 'loading', places: [], error: '' });
  const timer = text.length < 2 ? undefined : setTimeout(async () => {
    try { const places = await search(text, language, controller.signal); publish({ status: 'success', places, error: '' }); }
    catch (cause) { publish({ status: 'error', places: [], error: cause instanceof Error && !(cause instanceof TypeError) ? cause.message : 'Couldn’t reach location search. Check your connection and try again.' }); }
  }, delay);
  return () => { active = false; clearTimeout(timer); controller.abort(); };
}
