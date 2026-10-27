const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const m = load('src/lib/money.ts'); const fx = load('src/lib/exchange-rates.ts'); const state = load('src/lib/travel-state.ts'); const portable = load('src/lib/portable-data.ts'); const { calendarFile } = load('src/lib/calendar-file.ts');
// Controlled transport fixtures test arithmetic and failure handling; no fixture rates ship in the app.
const now = Date.parse('2026-10-26T12:00:00Z');
const response = () => ({ result: 'success', base_code: 'USD', time_last_update_unix: (now - 3600000) / 1000, time_next_update_unix: (now + 23 * 3600000) / 1000, rates: { USD: 1, INR: 80, PKR: 280, EUR: 0.9, JPY: 150, KWD: 0.3 } });
const report = () => fx.parseExchangeResponse(response(), now);
const disk = () => { let raw = null; return { getItem: async () => raw, setItem: async (_, next) => { raw = next; }, raw: () => raw }; };

test('country mappings cover India, Pakistan, USA and current currencies in other supported countries', () => {
  for (const [country, currency] of Object.entries({ IN: 'INR', PK: 'PKR', US: 'USD', GB: 'GBP', AE: 'AED', JP: 'JPY', ID: 'IDR', MV: 'MVR', IT: 'EUR', GR: 'EUR', BG: 'EUR', CA: 'CAD', AU: 'AUD' })) assert.equal(m.currencyForCountry(country), currency);
  assert.equal(m.currencyForCountry('not-a-country'), null); assert.ok(Object.keys(m.countryCurrencies).length >= 240);
  for (const [name, code] of [['india', 'IN'], ['Pakistan', 'PK'], ['USA', 'US'], ['United States', 'US'], ['United States of America', 'US'], ['भारत', 'IN']]) assert.equal(m.countryCodeForName(name), code);
});
test('country selection follows explicit preference, Home, profile then device; currency override is independent', () => {
  assert.equal(m.resolveMoneyCountry(m.moneyDefaults, 'India', 'San Francisco, USA', 'GB'), 'IN');
  assert.equal(m.resolveMoneyCountry({ countryCode: 'PK', override: 'EUR' }, 'India', '', 'US'), 'PK');
  assert.equal(m.resolveMoneyCountry(m.moneyDefaults, undefined, 'Miami, USA', 'GB'), 'US');
  assert.equal(m.resolveMoneyCountry(m.moneyDefaults, undefined, '', 'GB'), 'GB');
  assert.equal(m.validMoneyPreferences({ countryCode: 'IN', override: 'PKR' }), true);
  assert.equal(m.validMoneyPreferences({ countryCode: 'ZZ', override: null }), false);
  assert.equal(m.validMoneyPreferences({ countryCode: 'US', override: 'FAKE' }), false);
});
test('locale-aware formatting uses rupee symbols, Indian grouping, currency codes and currency fraction digits', () => {
  assert.equal(m.formatMoney(123456.78, 'INR', 'en-IN'), '₹1,23,456.78 INR');
  assert.match(m.formatMoney(28000, 'PKR', 'en-PK'), /₨\s?28,000 PKR/);
  assert.equal(m.formatMoney(1000, 'USD', 'en-US'), '$1,000 USD');
  assert.match(m.formatMoney(1000.50, 'EUR', 'es-ES'), /1000,50|1000,5|1\.000,5/);
  assert.match(m.formatMoney(123.456, 'KWD', 'en-US'), /123\.456/);
  assert.doesNotMatch(m.formatMoney(123.45, 'JPY', 'en-US'), /\.45/);
  assert.equal(m.formatMoney(NaN), '—');
});
test('display converts actual numbers, handles zero, and never changes only a currency symbol', () => {
  assert.equal(m.displayMoney(1000, 'INR', 'en-IN', report(), now), '≈ ₹80,000 INR');
  assert.match(m.displayMoney(1000, 'PKR', 'en-PK', report(), now), /^≈ ₨\s?280,000 PKR$/);
  assert.equal(m.displayMoney(0, 'INR', 'en-IN', report(), now), '≈ ₹0 INR');
  assert.equal(m.displayMoney(1000, 'INR', 'en-IN', null, now), '$1,000 USD');
  assert.equal(m.displayMoney(1000, 'KPW', 'en-US', report(), now), '$1,000 USD');
});
test('fresh, stale and expired rates are distinct; missing or malformed rates never become 1', () => {
  const r = report(); assert.equal(m.ratesAreFresh(r, now), true); assert.equal(m.ratesAreFresh(r, now + 2 * 86400000), false);
  assert.equal(m.usableRate('INR', r, now + 2 * 86400000), 80); assert.equal(m.usableRate('INR', r, now + 8 * 86400000), null);
  assert.equal(m.usableRate('USD', null, now), 1); assert.equal(m.usableRate('INR', { ...r, rates: { USD: 1, INR: 0 } }, now), null);
  assert.throws(() => fx.parseExchangeResponse({ ...response(), base_code: 'EUR' }, now), /Valid USD/);
  assert.throws(() => fx.parseExchangeResponse({ ...response(), rates: { USD: 2 } }, now), /Valid USD/);
  assert.throws(() => fx.parseExchangeResponse({ ...response(), time_last_update_unix: (now + 86400000) / 1000 }, now), /Valid USD/);
});
test('localized input converts to USD, rejects invalid values and respects non-dollar precision', () => {
  assert.equal(m.parseMoneyInput('80,000.50', 'en-IN') / 80, 1000.00625);
  assert.equal(m.parseMoneyInput('1.234,50', 'es-ES'), 1234.5);
  for (const text of ['', 'abc', '-2', '1.2.3', 'Infinity']) assert.ok(Number.isNaN(m.parseMoneyInput(text, 'en-IN')));
  assert.equal(m.moneyInputText(1000, 80, 'en-IN', 'INR'), '80000');
  assert.equal(m.moneyInputText(1.234, 1, 'en-US', 'KWD'), '1.234');
});
test('switching country and override persists without modifying any existing numeric amount', async () => {
  const storage = disk(); const store = state.createTravelStore(storage); await store.load(); const trip = state.createTrip('bali', 'Money stays safe', '2099-01-01'); trip.budget = 1000.123456; trip.itinerary = [{ id: 'x', title: 'Walk', destinationId: 'bali', day: 1, time: '09:00', notes: '', cost: 25.123456 }];
  await store.update((s) => state.saveTrip(s, trip)); const original = structuredClone((await store.load()).trips[0]);
  for (const countryCode of ['IN', 'PK', 'US', 'JP']) await store.update((s) => ({ ...s, settings: { ...s.settings, money: { countryCode, override: null } } }));
  await store.update((s) => ({ ...s, settings: { ...s.settings, money: { countryCode: 'IN', override: 'EUR' } } }));
  const loaded = await state.createTravelStore(storage).load(); assert.deepEqual(loaded.settings.money, { countryCode: 'IN', override: 'EUR' }); assert.deepEqual(loaded.trips[0], original);
  const restored = portable.readPortable(portable.exportBackup(loaded)).data; assert.deepEqual(restored.settings.money, loaded.settings.money); assert.deepEqual(restored.trips, loaded.trips);
  const legacy = structuredClone(loaded); delete legacy.settings.money; assert.equal(state.parseTravelState(JSON.stringify(legacy)).trips[0].budget, trip.budget);
});
test('single-flight real request adapter validates, caches and reuses all-country rates across switches', async () => {
  const storage = disk(); let calls = 0; let time = now;
  const request = async (url, options) => { calls++; assert.equal(url, fx.exchangeEndpoint); assert.ok(options.signal); return { ok: true, json: async () => response() }; };
  const store = fx.createExchangeStore(storage, request, () => time); await store.load(); const values = await Promise.all([store.refresh(), store.refresh(), store.refresh()]);
  assert.equal(calls, 1); assert.deepEqual(values[0], values[1]); assert.ok(storage.raw());
  await store.refresh(true); assert.equal(calls, 1); time += 3600001; await store.refresh(); assert.equal(calls, 1);
  const reopened = fx.createExchangeStore(storage, request, () => time); assert.equal((await reopened.load()).rates.PKR, 280); await reopened.refresh(); assert.equal(calls, 1);
});
test('HTTP failures preserve cached data and original amounts, and a later retry recovers', async () => {
  const storage = disk(); let bad = false; let time = now;
  const store = fx.createExchangeStore(storage, async () => bad ? { ok: false, status: 429 } : { ok: true, json: async () => response() }, () => time);
  await store.load(); const r = await store.refresh(); const before = storage.raw(); bad = true; time += 2 * 86400000;
  await assert.rejects(store.refresh(), /busy/); assert.equal(storage.raw(), before); assert.equal(m.usableRate('INR', r, time), 80);
  bad = false; assert.equal((await store.refresh()).rates.INR, 80);
});
test('invalid response and corrupt cache fail safely without replacing saved rates', async () => {
  const storage = disk(); await storage.setItem('', 'not-json'); const store = fx.createExchangeStore(storage, async () => ({ ok: true, json: async () => ({ result: 'error' }) }), () => now);
  assert.equal(await store.load(), null); await assert.rejects(store.refresh(), /Valid USD/); assert.equal(storage.raw(), 'not-json');
});
test('summaries and calendar exports use the same display conversion while importable data stays canonical', () => {
  const trip = state.createTrip('bali', 'Original budget', '2099-01-01'); const format = (n) => m.displayMoney(n, 'INR', 'en-IN', report(), now);
  assert.match(portable.tripSummary(trip, format), /₹80,000 INR/); assert.match(calendarFile(trip, new Date(now), format).replace(/\r\n /g, ''), /₹80\\,000 INR/);
  const s = { ...state.initialTravelState, trips: [trip] }; assert.equal(portable.readPortable(portable.exportTrip(s, trip)).data.trips[0].budget, 1000);
});
