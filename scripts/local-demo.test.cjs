const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { createLocalDemoAccess, createDemoTravelStorage, localDemoActive, localDemoSessionKey, localDemoDataPrefix } = load('src/lib/local-demo.ts');
const { createTravelStore, initialTravelState, travelStorageKey, createTrip, saveTrip, localDate } = load('src/lib/travel-state.ts');
function disk() { const values = new Map(); const operations = []; return { values, operations, getItem: async key => { operations.push(['read', key]); return values.get(key) ?? null; }, setItem: async (key, value) => { operations.push(['write', key]); values.set(key, value); }, removeItem: async key => { operations.push(['remove', key]); values.delete(key); } }; }

test('local demo access persists a marker only, restores on restart and exits without an auth session', async () => {
  const storage = disk(); const access = createLocalDemoAccess(storage, true);
  assert.equal(await access.restore(), false);
  await access.start(); assert.equal(await createLocalDemoAccess(storage, true).restore(), true);
  assert.equal(storage.values.size, 1);
  assert.equal(storage.values.get(localDemoSessionKey), 'local-demo-v1');
  assert.doesNotMatch([...storage.values.values()].join(''), /password|access_token|refresh_token|email_confirmed_at/);
  await access.stop(); assert.equal(await access.restore(), false);
});

test('production rejects demo entry and ignores a planted development marker without touching storage', async () => {
  const storage = disk(); storage.values.set(localDemoSessionKey, 'local-demo-v1');
  const access = createLocalDemoAccess(storage, false);
  assert.equal(await access.restore(), false);
  await assert.rejects(access.start(), /development/);
  await assert.rejects(access.stop(), /development/);
  assert.deepEqual(storage.operations, []);
  for (const requested of [true, false]) for (const hasCloud of [true, false]) assert.equal(localDemoActive(false, requested, hasCloud), false);
  assert.equal(localDemoActive(true, true, false), true);
  assert.equal(localDemoActive(true, true, true), false); // A real session always takes priority.
});

test('demo storage failures never report entry or exit as successful', async () => {
  const storage = disk(); const access = createLocalDemoAccess({ ...storage, setItem: async () => { throw Error('disk write'); } }, true);
  await assert.rejects(access.start(), /disk write/); assert.equal(await access.restore(), false);
  storage.values.set(localDemoSessionKey, 'local-demo-v1');
  const cannotExit = createLocalDemoAccess({ ...storage, removeItem: async () => { throw Error('disk remove'); } }, true);
  await assert.rejects(cannotExit.stop(), /disk remove/); assert.equal(await cannotExit.restore(), true);
  storage.values.set(localDemoSessionKey, 'unrecognized marker'); assert.equal(await access.restore(), false);
});

test('demo profile, saved destinations and trip/packing edits persist separately from existing regular trips', async () => {
  const storage = disk(); const regular = { ...initialTravelState, profile: { name: 'Real Traveler', location: 'Delhi' }, saved: ['kyoto'], trips: [createTrip('bali', 'My regular journey', localDate())] };
  const original = JSON.stringify(regular); storage.values.set(travelStorageKey, original);
  const demo = createTravelStore(createDemoTravelStorage(storage));
  const fresh = await demo.load(); assert.equal(fresh.profile.name, 'Demo Traveler'); assert.deepEqual(fresh.trips, []); assert.deepEqual(fresh.cloudLinks, []);
  assert.ok(storage.operations.every(([, key]) => key.startsWith(localDemoDataPrefix)));
  const trip = createTrip('bali', 'My demo journey', localDate());
  await demo.update(value => saveTrip({ ...value, profile: { name: 'Demo Explorer', location: 'Mumbai' }, saved: ['bali'] }, trip));
  await demo.update(value => ({ ...value, trips: value.trips.map(item => ({ ...item, packing: item.packing.map((row, index) => index === 0 ? { ...row, packed: true, packedCount: row.quantity ?? 1 } : row) })) }));
  const restored = await createTravelStore(createDemoTravelStorage(storage)).load();
  assert.equal(restored.profile.name, 'Demo Explorer'); assert.deepEqual(restored.saved, ['bali']); assert.equal(restored.trips[0].title, 'My demo journey'); assert.equal(restored.trips[0].packing[0].packed, true);
  assert.equal(storage.values.get(travelStorageKey), original);
  assert.deepEqual((await createTravelStore(storage).load()).trips, regular.trips);
});

test('leaving and re-entering the demo preserves both collections without merging', async () => {
  const storage = disk(); const access = createLocalDemoAccess(storage, true);
  storage.values.set(travelStorageKey, JSON.stringify(initialTravelState));
  const demo = createTravelStore(createDemoTravelStorage(storage)); await demo.load();
  await demo.update(value => ({ ...value, saved: ['bali'] }));
  const snapshot = new Map(storage.values);
  await access.start(); await access.stop();
  for (const [key, value] of snapshot) assert.equal(storage.values.get(key), value);
  await access.start(); assert.deepEqual((await createTravelStore(createDemoTravelStorage(storage)).load()).saved, ['bali']);
  assert.deepEqual((await createTravelStore(storage).load()).saved, []);
});
