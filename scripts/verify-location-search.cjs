// Live, read-only provider verification. No credentials or app storage are read.
const { load } = require('./test-support.cjs');
const { searchPlaces } = load('src/lib/discovery.ts');
const { fetchForecast } = load('src/lib/weather.ts');
const { parseTravelState, createTrip, saveTrip, localDate, addDays } = load('src/lib/travel-state.ts');
const assert = require('node:assert/strict');
(async () => {
  const report = { checkedAt: new Date().toISOString(), queries: [] };
  for (const query of ['Paris, France', 'France', 'Springfield', 'Mumbai, India', 'zzzxqvnomatchplace']) {
    const places = await searchPlaces(query);
    report.queries.push({ query, count: places.length, places: places.slice(0, 3) });
    if (query === 'France') assert.ok(places.some((p) => p.kind === 'country' && p.countryCode === 'FR'));
    if (query === 'Springfield') assert.ok(places.filter((p) => p.name === 'Springfield').length > 1);
    if (query === 'Paris, France') {
      const place = places.find((p) => p.id === 'geo-2988507'); assert.ok(place);
      const state = parseTravelState(null); state.customPlaces = [place];
      const saved = parseTravelState(JSON.stringify(saveTrip(state, createTrip(place.id, 'Location verification', addDays(localDate(), 7)))));
      const stop = saved.trips[0].stops[0]; assert.deepEqual(stop.place, place);
      const forecast = await fetchForecast(stop.place); assert.equal(forecast.placeId, place.id);
      report.weather = { placeId: forecast.placeId, latitude: forecast.latitude, longitude: forecast.longitude, timezone: forecast.timezone, returnedDays: forecast.days.length };
    }
    if (query === 'zzzxqvnomatchplace') assert.equal(places.length, 0);
  }
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
