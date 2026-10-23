const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { calendarColumns, shouldDismissSheet } = load('src/lib/interface-policy.ts');
const { createTravelStore, parseTravelState } = load('src/lib/travel-state.ts');
const { readFileSync } = require('node:fs');
const paletteSource = readFileSync(require('node:path').join(__dirname, '../src/constants/waylo.ts'), 'utf8');
const colors = Object.fromEntries(Array.from(paletteSource.matchAll(/(\w+): '(#[A-Fa-f0-9]{6})'/g), (match) => [match[1], match[2]]));

test('calendar preserves minimum target widths on small screens and when text grows', () => {
  assert.equal(calendarColumns(320, 1), 3);
  assert.equal(calendarColumns(360, 1), 3);
  assert.equal(calendarColumns(390, 1), 7);
  assert.equal(calendarColumns(768, 1), 7);
  assert.equal(calendarColumns(390, 1.5), 3);
  assert.equal(calendarColumns(1024, 2), 3);
  for (const width of [320, 360, 390, 430, 768]) assert.ok((Math.min(width, 640) - 48) / calendarColumns(width, 1) >= 48);
});
test('sheet dismisses intentional downward drags and flicks but ignores upward or incidental motion', () => {
  assert.equal(shouldDismissSheet(96, 0), true);
  assert.equal(shouldDismissSheet(24, 900), true);
  assert.equal(shouldDismissSheet(23, 2000), false);
  assert.equal(shouldDismissSheet(80, 200), false);
  assert.equal(shouldDismissSheet(-150, -1400), false);
});
test('legacy settings stay readable and the haptics choice persists without touching travel data', async () => {
  const old = parseTravelState(null); delete old.settings.hapticsEnabled;
  let raw = JSON.stringify(old);
  const disk = { getItem: async () => raw, setItem: async (_, value) => { raw = value; } };
  const store = createTravelStore(disk); await store.load();
  await store.update((value) => ({ ...value, settings: { ...value.settings, hapticsEnabled: false } }));
  const restored = await createTravelStore(disk).load();
  assert.equal(restored.settings.hapticsEnabled, false);
  assert.deepEqual(restored.profile, old.profile);
  assert.deepEqual(restored.trips, old.trips);
  const bad = { ...restored, settings: { ...restored.settings, hapticsEnabled: 'yes' } };
  assert.throws(() => parseTravelState(JSON.stringify(bad)), /original data/);
});
test('primary, secondary, muted and error text meet normal-text contrast on their shared surfaces', () => {
  const luminance = (hex) => { const rgb = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4); return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722; };
  for (const [text, background] of [['ink','canvas'],['muted','canvas'],['muted','white'],['muted','sage'],['pine','sage'],['canvas','pine'],['champagne','pine'],['danger','canvas']]) {
    const pair = [luminance(colors[text]), luminance(colors[background])].sort((a,b) => b-a);
    assert.ok((pair[0] + 0.05) / (pair[1] + 0.05) >= 4.5, `${text} on ${background}`);
  }
});
