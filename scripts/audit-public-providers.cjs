// Read-only public-provider smoke checks using production parsers/adapters.
// No account, private trip, location permission, AI or authenticated service is used.
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load } = require('./test-support.cjs');
const { searchPlaces, nearbyPlaces } = load('src/lib/discovery.ts');
const { fetchForecast } = load('src/lib/weather.ts');
const { parseExchangeResponse, exchangeEndpoint } = load('src/lib/exchange-rates.ts');
const { displayMoney, usableRate } = load('src/lib/money.ts');
const report = { checkedAt: new Date().toISOString(), status: 'RUNNING', scope: 'Read-only public provider availability with production parsers; not phone or commercial-license acceptance', checks: [], authenticatedLive: 'not performed' };
const check = async (name, action) => {
  try { const details = await action(); report.checks.push({ name, status: 'passed', ...details }); console.log(`PASS: ${name}`); }
  catch (error) {
    const status = /Provider request failed \((\d{3})\)/.exec(error?.message ?? '');
    const transport = ['EACCES', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.cause?.code) ? error.cause.code : null;
    report.checks.push({ name, status: 'failed', reason: 'Provider request or production-parser assertion failed; no response body logged', ...(status ? { httpStatus: Number(status[1]) } : {}), ...(transport ? { transport } : {}) });
    console.log(`FAIL: ${name}${status ? ` (HTTP ${status[1]})` : ''}`);
  }
};
async function main() {
  const selected = new Map();
  for (const [query, country, kind] of [['Mumbai', 'IN', 'city'], ['Lahore', 'PK', 'city'], ['New York', 'US', 'city'], ['India', 'IN', 'country']]) {
    await check(`Live place search: ${query}`, async () => {
      const places = await searchPlaces(query);
      const place = places.find(value => value.countryCode === country && value.kind === kind);
      assert.ok(place); assert.equal(new Set(places.map(value => value.id)).size, places.length);
      assert.ok(Number.isFinite(place.latitude) && Number.isFinite(place.longitude)); selected.set(query, place);
      return { results: places.length, matchedKind: place.kind, countryCode: place.countryCode, uniqueProviderId: true, coordinatesValid: true };
    });
  }
  await check('Live same-name location disambiguation', async () => {
    const places = await searchPlaces('Springfield');
    assert.ok(places.length > 1 && new Set(places.map(value => value.id)).size === places.length);
    assert.ok(places.some(value => value.region));
    return { results: places.length, distinctProviderIds: true, regionsPresent: true };
  });
  if (selected.has('Mumbai')) {
    await check('Real daily/hourly forecast for the selected provider coordinates', async () => {
      const place = selected.get('Mumbai'), forecast = await fetchForecast(place);
      assert.equal(forecast.placeId, place.id); assert.ok(forecast.days.length > 0);
      return { source: forecast.source, days: forecast.days.length, firstDate: forecast.days[0].date, lastDate: forecast.days.at(-1).date, hourlyDataPresent: forecast.days.some(day => day.hours.length), rainDataPresent: forecast.days.some(day => day.rainProbability !== null) };
    });
    await check('Real nearby OpenStreetMap results', async () => {
      const place = selected.get('Mumbai'), places = await nearbyPlaces(place.latitude, place.longitude, 'Sights');
      assert.ok(Array.isArray(places)); return { source: 'OpenStreetMap / Overpass', results: places.length, emptyIsValid: places.length === 0 };
    });
  } else report.checks.push({ name: 'Weather and nearby providers', status: 'blocked', reason: 'Live Mumbai lookup did not provide usable coordinates' });
  await check('Real USD exchange rates and INR/PKR/USD formatting', async () => {
    const response = await fetch(exchangeEndpoint, { signal: AbortSignal.timeout(12000) }); assert.ok(response.ok);
    const rates = parseExchangeResponse(await response.json());
    for (const currency of ['INR', 'PKR', 'USD']) assert.ok(usableRate(currency, rates));
    return { source: rates.source, updatedAt: new Date(rates.updatedAt).toISOString(), samplesFor100USD: ['INR', 'PKR', 'USD'].map(currency => ({ currency, display: displayMoney(100, currency, currency === 'INR' ? 'en-IN' : 'en-US', rates) })) };
  });
  report.status = report.checks.some(value => value.status === 'failed') ? 'FAILED' : report.checks.some(value => value.status === 'blocked') ? 'BLOCKED' : 'PASSED';
}
main().catch(() => { report.status = 'FAILED'; report.checks.push({ name: 'Provider verification setup', status: 'failed' }); }).finally(() => {
  mkdirSync('docs/verification', { recursive: true });
  writeFileSync('docs/verification/platform-public-providers.json', JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.status === 'PASSED' ? 0 : 1;
});
