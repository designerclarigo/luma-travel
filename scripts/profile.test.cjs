const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { profileStatistics, profileInitials, saveProfile, saveTravelDefaults, saveInboxPreferences } = load('src/lib/profile.ts');
const { initialTravelState, createTravelStore } = load('src/lib/travel-state.ts');
const fresh = () => structuredClone(initialTravelState);

test('profile statistics use real trips, known saved places and unique visited countries', () => {
  const data = fresh();
  assert.deepEqual(profileStatistics(data, ['bali']), { trips: 0, saved: 0, visited: 0, unread: 1 });
  data.trips = [{ id: 'planned' }, { id: 'completed', completedAt: '2026-01-01' }];
  data.saved = ['bali', 'bali', 'removed-catalog-entry'];
  data.passport = [{ code: 'ID', status: 'visited' }, { code: 'ID', status: 'visited' }, { code: 'GR', status: 'wishlist' }];
  assert.deepEqual(profileStatistics(data, ['bali']), { trips: 2, saved: 1, visited: 1, unread: 1 });
});
test('notification count matches visible inbox and excludes read or hidden inspiration', () => {
  const data = fresh(); data.preferences.inspiration = false;
  data.notifications = [{ read: false }, { read: false, tripId: 'trip' }, { read: true, tripId: 'trip' }];
  assert.equal(profileStatistics(data, []).unread, 1);
  data.preferences.inspiration = true;
  assert.equal(profileStatistics(data, []).unread, 2);
});
test('initials handle a single name, whitespace and non-ASCII names', () => {
  assert.equal(profileInitials('  Alex   Morgan '), 'AM');
  assert.equal(profileInitials('Ari'), 'A');
  assert.equal(profileInitials('élise de Vries'), 'ÉV');
  assert.equal(profileInitials('李 明'), '李明');
  assert.equal(profileInitials(''), 'W');
});
test('profile edits trim input, preserve unrelated data and reject empty values without mutation', () => {
  const data = fresh(); const original = structuredClone(data);
  assert.throws(() => saveProfile(data, { name: ' ', location: 'Lisbon' }), /Add your name/);
  assert.throws(() => saveProfile(data, { name: 'Ari', location: '' }), /Add your name/);
  assert.throws(() => saveProfile(data, { name: 'a'.repeat(101), location: 'Lisbon' }), /100 characters/);
  const changed = saveProfile(data, { name: ' Ari Santos ', location: ' Lisbon, Portugal ' });
  assert.deepEqual(changed.profile, { name: 'Ari Santos', location: 'Lisbon, Portugal' });
  assert.equal(changed.trips, data.trips); assert.equal(changed.preferences, data.preferences);
  assert.deepEqual(data, original);
});
test('separate settings editors preserve the latest changes from other flows', () => {
  const data = fresh(); const interests = ['Nature', 'Food'];
  const travel = saveTravelDefaults(data, { interests, pace: 'Relaxed', travelers: 3 });
  const inbox = saveInboxPreferences(travel, { tripUpdates: false, inspiration: false });
  assert.deepEqual(inbox.preferences, { interests, pace: 'Relaxed', travelers: 3, tripUpdates: false, inspiration: false });
  const newDefaults = saveTravelDefaults(inbox, { interests: ['Culture'], pace: 'Balanced', travelers: 1 });
  assert.equal(newDefaults.preferences.inspiration, false); assert.equal(newDefaults.preferences.tripUpdates, false);
  interests.push('Beaches'); assert.deepEqual(travel.preferences.interests, ['Nature', 'Food']);
  assert.throws(() => saveTravelDefaults(data, { interests: [], pace: 'Balanced', travelers: 21 }), /1 and 20/);
});
test('profile and separate preference changes persist through the real store, including a failed write retry', async () => {
  let raw = null; let fail = true;
  const disk = { getItem: async () => raw, setItem: async (_, value) => { if (fail) throw Error('disk unavailable'); raw = value; } };
  const store = createTravelStore(disk); await store.load();
  await assert.rejects(store.update((value) => saveProfile(value, { name: 'Ari', location: 'Lisbon' })), /disk unavailable/);
  assert.equal(raw, null); fail = false;
  await Promise.all([
    store.update((value) => saveProfile(value, { name: ' Ari ', location: ' Lisbon ' })),
    store.update((value) => saveTravelDefaults(value, { interests: ['Culture'], pace: 'Relaxed', travelers: 3 })),
    store.update((value) => saveInboxPreferences(value, { tripUpdates: false, inspiration: false })),
  ]);
  const restored = await createTravelStore(disk).load();
  assert.deepEqual(restored.profile, { name: 'Ari', location: 'Lisbon' });
  assert.deepEqual(restored.preferences, { interests: ['Culture'], pace: 'Relaxed', travelers: 3, tripUpdates: false, inspiration: false });
});
