const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const state = load('src/lib/travel-state.ts');
const { catalogPlaces } = load('src/constants/places.ts');
const { moveRouteStop, routeIssues, stopNights, validateStops } = load('src/lib/route-planning.ts');
const { summarizeStopWeather, weatherCondition } = load('src/lib/weather-summary.ts');
const { nextDashboardTrip, departureCountdown } = load('src/lib/home-dashboard.ts');
const fixture = () => {
  const trip = state.createTrip('bali', 'A thoughtful route', '2099-10-30'); trip.endDate = '2099-11-05';
  trip.destinationIds = ['bali', 'braies', 'kyoto'];
  trip.stops = [
    { id: 'a', place: catalogPlaces[0], arrival: '2099-10-30', departure: '2099-11-01' },
    { id: 'b', place: catalogPlaces[1], arrival: '2099-11-01', departure: '2099-11-02' },
    { id: 'c', place: catalogPlaces[3], arrival: '2099-11-03', departure: '2099-11-05' },
  ]; return trip;
};
test('route moves retain nights, overall dates, shared travel days and exact place IDs/coordinates', () => {
  const trip = fixture(); const original = structuredClone(trip); const result = moveRouteStop(trip.stops, 2, 0, trip);
  assert.deepEqual(result.stops.map((s) => s.id), ['c', 'a', 'b']);
  assert.equal(result.stops[0].arrival, trip.departure); assert.equal(result.stops.at(-1).departure, trip.endDate);
  assert.equal(result.stops[1].arrival, result.stops[0].departure); assert.equal(state.tripDays(result.stops[1].departure, result.stops[2].arrival), 2);
  for (const stop of result.stops) { const before = trip.stops.find((s) => s.id === stop.id); assert.equal(stopNights(stop), stopNights(before)); assert.deepEqual(stop.place, before.place); }
  assert.equal(validateStops(result.stops, { ...trip, itinerary: result.itinerary }), null); assert.deepEqual(trip, original);
});
test('linked activities move with their own destination, retaining time, cost, notes and identity', () => {
  const trip = fixture(); trip.itinerary = [{ id: 'walk', destinationId: 'kyoto', day: 6, title: 'Walk by the river', time: '10:00', cost: 12, notes: 'My notes', packForActivity: true, activity: 'hike' }];
  const result = moveRouteStop(trip.stops, 2, 0, trip);
  assert.equal(result.itinerary[0].day, 2); assert.deepEqual({ ...result.itinerary[0], day: 6 }, trip.itinerary[0]);
  assert.equal(routeIssues(result.stops, { ...trip, itinerary: result.itinerary }).length, 0);
});
test('same-day visits remain ordered and zero nights are represented accurately', () => {
  const trip = fixture(); trip.endDate = trip.departure; trip.stops = trip.stops.map((s) => ({ ...s, arrival: trip.departure, departure: trip.departure }));
  const result = moveRouteStop(trip.stops, 0, 2, trip); assert.deepEqual(result.stops.map((s) => s.id), ['b', 'c', 'a']);
  assert.ok(result.stops.every((s) => stopNights(s) === 0)); assert.equal(validateStops(result.stops, trip), null);
});
test('date warnings identify overlaps, coverage gaps, out-of-bounds dates and orphan activities', () => {
  const trip = fixture(); const overlap = trip.stops.map((s) => ({ ...s })); overlap[1].arrival = '2099-10-31';
  assert.ok(routeIssues(overlap, trip).some((issue) => issue.stopId === 'b' && issue.message.includes('before')));
  assert.throws(() => moveRouteStop(overlap, 1, 0, trip), /Resolve/);
  const gap = trip.stops.map((s) => ({ ...s })); gap[1].arrival = '2099-11-03'; gap[1].departure = '2099-11-03';
  assert.ok(routeIssues(gap, trip).some((issue) => issue.message.includes('unplanned')));
  assert.ok(routeIssues([{ ...trip.stops[0], arrival: '2099-10-29' }], trip).some((issue) => issue.message.includes('outside')));
  assert.ok(routeIssues(trip.stops, { ...trip, endDate: '2099-10-29' }).some((issue) => issue.stopId === null && issue.message.includes('valid trip dates')));
  trip.itinerary = [{ id: 'x', destinationId: 'kyoto', day: 1, title: 'Tea', time: '09:00', cost: 0, notes: '' }];
  assert.ok(routeIssues(trip.stops, trip).some((issue) => issue.stopId === 'c' && issue.message.includes('Tea')));
});
test('reordered route, moved activities and packing checks persist through the production store', async () => {
  let raw = null; const disk = { getItem: async () => raw, setItem: async (_, value) => { raw = value; } };
  const store = state.createTravelStore(disk); await store.load(); const trip = fixture(); trip.packing[0].packed = true; trip.packing[0].packedCount = trip.packing[0].quantity;
  await store.update((v) => state.saveTrip(v, trip)); const moved = moveRouteStop(trip.stops, 2, 0, trip);
  await store.update((v) => state.saveTrip(v, { ...v.trips[0], ...moved, destinationIds: moved.stops.map((s) => s.place.id) }));
  const reopened = (await state.createTravelStore(disk).load()).trips[0]; assert.deepEqual(reopened.stops.map((s) => s.id), ['c', 'a', 'b']);
  assert.equal(reopened.destinationId, 'kyoto'); assert.equal(reopened.packing[0].packed, true);
});
test('weather summaries aggregate only returned travel dates and disclose partial/null coverage', () => {
  const stop = fixture().stops[0];
  const day = (date, low, high, rainProbability, code) => ({ date, low, high, rainProbability, code, rainMm: null, hours: [] });
  const report = { placeId: stop.place.id, days: [day('2099-10-29', -50, 99, 100, 95), day('2099-10-30', 10, 18, 0, 0), day('2099-10-31', 12, 20, null, 61)] };
  const summary = summarizeStopWeather(stop, report);
  assert.equal(summary.low, 10); assert.equal(summary.high, 20); assert.equal(summary.rain, 0); assert.equal(summary.days.length, 2); assert.equal(summary.expectedDays, 3); assert.equal(summary.rainDaysCovered, 1);
  assert.deepEqual(summary.conditions, ['Sunny', 'Rain']);
  assert.equal(summarizeStopWeather(stop, { ...report, placeId: 'different' }).days.length, 0); assert.equal(summarizeStopWeather(stop).low, null);
  assert.equal(weatherCondition(null), 'Conditions unavailable'); assert.equal(weatherCondition(999), 'Conditions unavailable'); assert.equal(weatherCondition(97), 'Thunderstorms');
});
test('dashboard selects the closest saved journey without mutating records or including past/completed trips', () => {
  const base = fixture(); const trips = [{ ...base, id: 'past', departure: '2026-10-01', endDate: '2026-10-10' }, { ...base, id: 'far', departure: '2026-12-01', endDate: '2026-12-04' }, { ...base, id: 'near', departure: '2026-10-30', endDate: '2026-11-02' }, { ...base, id: 'done', departure: '2026-10-27', endDate: '2026-10-28', completedAt: '2026-10-26T12:00:00Z' }];
  const before = structuredClone(trips); assert.equal(nextDashboardTrip(trips, '2026-10-26').id, 'near'); assert.deepEqual(trips, before);
  assert.equal(nextDashboardTrip([{ ...base, id: 'active', departure: '2026-10-25', endDate: '2026-10-29' }, ...trips], '2026-10-26').id, 'active');
  assert.equal(nextDashboardTrip([], '2026-10-26'), undefined);
});
test('departure countdown follows calendar days across month/year/leap boundaries', () => {
  const trip = { ...fixture(), departure: '2028-03-01', endDate: '2028-03-04' };
  assert.equal(departureCountdown(trip, '2028-02-28'), '2 days to go'); assert.equal(departureCountdown(trip, '2028-02-29'), '1 day to go');
  assert.equal(departureCountdown(trip, '2028-03-01'), 'Leaving today'); assert.equal(departureCountdown(trip, '2028-03-02'), 'Day 2 of 4');
});
