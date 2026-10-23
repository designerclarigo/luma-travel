const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { parsePlaces, searchPlaces } = load('src/lib/discovery.ts');
const { startPlaceSearch } = load('src/lib/place-search.ts');
const state = load('src/lib/travel-state.ts');
const { fetchForecast } = load('src/lib/weather.ts');
const { tripStatus, tripPlaces } = load('src/lib/trip-summary.ts');
const row = (id, admin1 = 'Illinois') => ({ id, name: 'Springfield', latitude: 39.80172, longitude: -89.64371, country_code: 'US', country: 'United States', admin1, feature_code: 'PPLA', timezone: 'America/Chicago' });
const pause = () => new Promise((r) => setTimeout(r, 20));

test('geocoder keeps duplicate names, deduplicates provider IDs, and retains regions and countries', () => {
  const places = parsePlaces({ results: [row(1), row(2, 'Missouri'), row(1)] });
  assert.equal(places.length, 2); assert.notEqual(places[0].id, places[1].id);
  assert.equal(places[0].region, 'Illinois'); assert.equal(places[1].region, 'Missouri');
  assert.equal(places[0].country, 'United States'); assert.equal(places[0].latitude, 39.80172);
});
test('country reference points are typed and malformed responses are errors, not fabricated matches', () => {
  const country = parsePlaces({ results: [{ ...row(3017382), name: 'France', country: 'France', country_code: 'FR', feature_code: 'PCLI', timezone: undefined }] })[0];
  assert.equal(country.kind, 'country'); assert.equal(country.timezone, 'auto');
  assert.deepEqual(parsePlaces({ generationtime_ms: 1 }), []);
  for (const value of [null, [], { results: {} }, { error: true }, { results: [{ ...row(1), latitude: 999 }] }]) assert.throws(() => parsePlaces(value));
});
test('rapid typing cancels the debounce before a network call; clearing has no network call', async () => {
  let calls = 0; const values = []; const search = async () => { calls++; return []; };
  const cancel = startPlaceSearch('Pa', 'en', (v) => values.push(v), search, 5); cancel();
  const stop = startPlaceSearch('', 'en', (v) => values.push(v), search, 5);
  await pause(); stop(); assert.equal(calls, 0); assert.equal(values.at(-1).status, 'idle');
});
test('obsolete requests are aborted and late responses cannot replace the newest results', async () => {
  const values = []; let finish; let oldSignal;
  const cancel = startPlaceSearch('Paris', 'en', (v) => values.push(v), (_, __, signal) => { oldSignal = signal; return new Promise((r) => { finish = r; }); }, 0);
  await pause(); cancel(); assert.equal(oldSignal.aborted, true);
  const stop = startPlaceSearch('Rome', 'en', (v) => values.push(v), async () => parsePlaces({ results: [{ ...row(3), name: 'Rome' }] }), 0);
  await pause(); finish(parsePlaces({ results: [row(1)] })); await pause(); stop();
  assert.equal(values.at(-1).query, 'Rome'); assert.equal(values.at(-1).places[0].name, 'Rome');
});
test('empty responses and network failures produce distinct success/empty and error states', async () => {
  const values = []; const stop = startPlaceSearch('zzzz', 'en', (v) => values.push(v), async () => [], 0);
  await pause(); stop(); assert.equal(values.at(-1).status, 'success'); assert.deepEqual(values.at(-1).places, []);
  const cancel = startPlaceSearch('Paris', 'en', (v) => values.push(v), async () => { throw new Error('Network unavailable'); }, 0);
  await pause(); cancel(); assert.equal(values.at(-1).status, 'error'); assert.equal(values.at(-1).error, 'Network unavailable');
  const retry = startPlaceSearch('Paris', 'en', (v) => values.push(v), async () => { throw new TypeError('Failed to fetch'); }, 0);
  await pause(); retry(); assert.match(values.at(-1).error, /Check your connection/);
});
test('production search encodes qualifiers and language and propagates HTTP errors', async (t) => {
  let url; t.mock.method(global, 'fetch', async (value) => { url = new URL(value); return { ok: true, json: async () => ({ results: [row(1)] }) }; });
  await searchPlaces(' Paris, France ', 'es');
  assert.equal(url.searchParams.get('name'), 'Paris, France'); assert.equal(url.searchParams.get('language'), 'es');
  global.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => searchPlaces('Paris'), /provider is busy/);
});
test('a selected worldwide place survives saving/reloading and supplies the exact forecast coordinates and ID', async (t) => {
  const place = parsePlaces({ results: [row(4250542)] })[0];
  const initial = state.parseTravelState(null); initial.customPlaces = [place];
  const trip = state.createTrip(place.id, 'Springfield weekend', state.addDays(state.localDate(), 7));
  const saved = state.parseTravelState(JSON.stringify(state.saveTrip(initial, trip)));
  const stop = saved.trips[0].stops[0]; assert.deepEqual(stop.place, place);
  assert.equal(saved.trips[0].destinationId, 'geo-4250542');
  assert.equal(tripPlaces(saved.trips[0], [])[0].name, 'Springfield');
  t.mock.method(global, 'fetch', async (value) => { const url = new URL(value); assert.equal(Number(url.searchParams.get('latitude')), place.latitude); assert.equal(Number(url.searchParams.get('longitude')), place.longitude); return { ok: true, json: async () => ({ latitude: place.latitude, longitude: place.longitude, timezone: place.timezone, daily: { time: [trip.departure], temperature_2m_min: [10], temperature_2m_max: [18] } }) }; });
  const report = await fetchForecast(stop.place); assert.equal(report.placeId, place.id);
});
test('trip badges distinguish completed trips, past dates, current trips and future plans', () => {
  const trip = { departure: '2026-10-23', endDate: '2026-10-26', completedAt: null };
  assert.equal(tripStatus(trip, '2026-10-22'), 'Upcoming'); assert.equal(tripStatus(trip, '2026-10-23'), 'In progress');
  assert.equal(tripStatus(trip, '2026-10-27'), 'Past'); assert.equal(tripStatus({ ...trip, completedAt: '2026-10-26' }, '2026-10-27'), 'Completed');
});
