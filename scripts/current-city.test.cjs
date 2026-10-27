const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { resolveCurrentCity, manualHomeLocation, validHomeLocation } = load('src/lib/current-city.ts');
const { createTravelStore, parseTravelState } = load('src/lib/travel-state.ts');
const adapter = (override = {}) => ({
  permission: async () => ({ status: 'granted', canAskAgain: true }),
  requestPermission: async () => { throw Error('Unexpected prompt'); },
  servicesEnabled: async () => true,
  position: async () => ({ coords: { latitude: 38.7223, longitude: -9.1393 } }),
  reverse: async () => [{ city: 'Lisbon', country: 'Portugal' }], ...override,
});
test('a permitted location fix reaches the native reverse adapter and saves only city/country', async () => {
  const stages = []; let coordinates;
  const result = await resolveCurrentCity(adapter({ reverse: async (value) => { coordinates = value; return [{ city: 'Lisbon', country: 'Portugal', street: 'Not retained' }]; } }), { onStage: (v) => stages.push(v) });
  assert.deepEqual(coordinates, { latitude: 38.7223, longitude: -9.1393 });
  assert.equal(result.status, 'ready'); assert.equal(result.location.city, 'Lisbon'); assert.equal(result.location.country, 'Portugal');
  assert.equal(result.location.source, 'device'); assert.equal(validHomeLocation(result.location), true);
  assert.deepEqual(Object.keys(result.location).sort(), ['city', 'country', 'source', 'updatedAt']);
  assert.deepEqual(stages, ['checking', 'locating', 'geocoding']);
});
test('first-visit permission checks do not prompt or read GPS until the user requests detection', async () => {
  let prompts = 0; let positions = 0;
  const service = adapter({ permission: async () => ({ status: 'undetermined', canAskAgain: true }), requestPermission: async () => { prompts++; return { status: 'granted', canAskAgain: true }; }, position: async () => { positions++; return { coords: { latitude: 1, longitude: 2 } }; } });
  assert.equal((await resolveCurrentCity(service)).status, 'permission'); assert.equal(prompts, 0); assert.equal(positions, 0);
  assert.equal((await resolveCurrentCity(service, { ask: true })).status, 'ready'); assert.equal(prompts, 1); assert.equal(positions, 1);
});
test('denial and permanent denial never fall through to GPS or geocoding', async () => {
  for (const canAskAgain of [true, false]) {
    let requested = 0;
    const result = await resolveCurrentCity(adapter({ permission: async () => ({ status: 'denied', canAskAgain }), requestPermission: async () => { requested++; return { status: 'denied', canAskAgain }; }, position: async () => { throw Error('GPS must not run'); }, reverse: async () => { throw Error('Reverse must not run'); } }), { ask: true });
    assert.equal(result.status, 'denied'); assert.equal(result.canAskAgain, canAskAgain); assert.equal(requested, canAskAgain ? 1 : 0);
  }
});
test('disabled services, unavailable addresses, and bad coordinates remain explicit failures', async () => {
  assert.equal((await resolveCurrentCity(adapter({ servicesEnabled: async () => false }))).status, 'services-off');
  await assert.rejects(() => resolveCurrentCity(adapter({ reverse: async () => [] })), /couldn’t identify its city/);
  await assert.rejects(() => resolveCurrentCity(adapter({ reverse: async () => [{ region: 'California', street: 'A street', country: 'United States' }] })), /couldn’t identify its city/);
  await assert.rejects(() => resolveCurrentCity(adapter({ position: async () => ({ coords: { latitude: 999, longitude: NaN } }) })), /usable location/);
  await assert.rejects(() => resolveCurrentCity(adapter({ reverse: async () => { throw Error('Native geocoder offline'); } })), /Native geocoder offline/);
});
test('timed-out location requests stop waiting, and cancellation suppresses late reverse geocoding', async () => {
  await assert.rejects(() => resolveCurrentCity(adapter({ position: () => new Promise(() => {}) }), { timeoutMs: 5 }), (error) => error.reason === 'timeout');
  const controller = new AbortController(); let release; let start; let reverseCalls = 0;
  const started = new Promise((resolve) => { start = resolve; });
  const pending = resolveCurrentCity(adapter({ position: () => { start(); return new Promise((r) => { release = r; }); }, reverse: async () => { reverseCalls++; return []; } }), { signal: controller.signal });
  await started; controller.abort(); await assert.rejects(pending, (error) => error.reason === 'cancelled');
  release({ coords: { latitude: 1, longitude: 2 } }); await Promise.resolve(); assert.equal(reverseCalls, 0);
});
test('manual location validates and persists independently of profile data and other travel records', async () => {
  let raw = null; const disk = { getItem: async () => raw, setItem: async (_, value) => { raw = value; } };
  const store = createTravelStore(disk); const first = await store.load(); assert.equal(first.profile.location, ''); assert.equal(first.homeLocation, undefined);
  await store.update((value) => ({ ...value, profile: { name: 'Ari', location: 'Mumbai, India' }, saved: ['bali'] }));
  await store.update((value) => ({ ...value, homeLocation: manualHomeLocation('  New   York ', ' United States ') }));
  const reopened = await createTravelStore(disk).load(); assert.equal(reopened.homeLocation.city, 'New York'); assert.equal(reopened.homeLocation.source, 'manual');
  assert.equal(reopened.profile.location, 'Mumbai, India'); assert.deepEqual(reopened.saved, ['bali']);
  for (const values of [['', 'India'], ['Pune', ''], ['x'.repeat(101), 'India']]) assert.throws(() => manualHomeLocation(...values));
  assert.throws(() => parseTravelState(JSON.stringify({ ...reopened, homeLocation: { ...reopened.homeLocation, source: 'guessed' } })), /Invalid saved travel data/);
  const legacy = { ...reopened }; delete legacy.homeLocation; assert.equal(parseTravelState(JSON.stringify(legacy)).profile.location, 'Mumbai, India');
});
