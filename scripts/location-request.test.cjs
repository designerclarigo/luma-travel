const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { createLocationRequester, createNativeLocationRequest, LocationHttpError } = load('src/lib/location-request-core.ts');
const endpoint = 'https://geocoding-api.open-meteo.com/v1/search?name=Mumbai&language=en';
const response = { results: [{ id: 1275339, name: 'Mumbai', country_code: 'IN', country: 'India', latitude: 19.07283, longitude: 72.88261 }] };

test('native city search recovers a plain Expo FetchError through one native request with the same URL and signal', async () => {
  const controller = new AbortController(); let calls = 0;
  const request = createLocationRequester(async () => { throw Error('fetch failed: native response read failed'); }, async (url, signal) => {
    calls++; assert.equal(url, endpoint); assert.equal(signal, controller.signal); return response;
  });
  assert.deepEqual(await request(endpoint, controller.signal), response); assert.equal(calls, 1);
});

test('native fallback does not retry HTTP failures or rate limits', async () => {
  let calls = 0;
  for (const status of [400, 429, 503]) {
    const request = createLocationRequester(async () => ({ ok: false, status }), async () => { calls++; });
    await assert.rejects(() => request(endpoint), (error) => error instanceof LocationHttpError && error.status === status);
  }
  assert.equal(calls, 0);
});

test('a stalled fetch/body settles on the deadline even if abort is ignored; late results cannot replace the native result', async () => {
  let finish; let signal;
  const request = createLocationRequester(async (_, options) => { signal = options.signal; return { ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }; }, async () => response, 8);
  const result = await request(endpoint); assert.equal(signal.aborted, true); assert.deepEqual(result, response);
  finish({ results: [] }); assert.deepEqual(result, response);
});

test('typing a new query cancels a pending request without starting a native fallback', async () => {
  const controller = new AbortController(); let calls = 0;
  const request = createLocationRequester(() => new Promise(() => {}), async () => { calls++; }, 100);
  const operation = request(endpoint, controller.signal); controller.abort();
  await assert.rejects(operation, /cancelled/); assert.equal(calls, 0);
  await assert.rejects(() => request(endpoint, controller.signal), /cancelled/); assert.equal(calls, 0);
});

function nativeAdapter(run) {
  return { status: 200, responseText: JSON.stringify(response), aborted: false,
    open(method, url, async) { assert.equal(method, 'GET'); assert.equal(url, endpoint); assert.equal(async, true); },
    setRequestHeader(name, value) { assert.equal(name, 'Accept'); assert.equal(value, 'application/json'); },
    send() { run(this); }, abort() { this.aborted = true; this.onabort?.(); },
  };
}

test('the native JSON reader retains provider data and handles malformed JSON and HTTP errors distinctly', async () => {
  const success = nativeAdapter(xhr => xhr.onload());
  assert.deepEqual(await createNativeLocationRequest(() => success)(endpoint), response); assert.equal(success.onload, null);
  const malformed = nativeAdapter(xhr => { xhr.responseText = '{'; xhr.onload(); });
  await assert.rejects(() => createNativeLocationRequest(() => malformed)(endpoint), /incomplete/);
  const busy = nativeAdapter(xhr => { xhr.status = 429; xhr.onload(); });
  await assert.rejects(() => createNativeLocationRequest(() => busy)(endpoint), /provider is busy/);
});

test('native cancellation and a missed native timeout both abort the request and remove its callbacks', async () => {
  const cancelled = nativeAdapter(() => {}); const controller = new AbortController();
  const operation = createNativeLocationRequest(() => cancelled)(endpoint, controller.signal); controller.abort();
  await assert.rejects(operation, /cancelled/); assert.equal(cancelled.aborted, true); assert.equal(cancelled.onload, null);
  const stalled = nativeAdapter(() => {});
  await assert.rejects(() => createNativeLocationRequest(() => stalled, 8)(endpoint), /timed out/); assert.equal(stalled.aborted, true);
});

test('failed transports show an actionable error instead of native Java/SSL internals or fabricated results', async () => {
  const request = createLocationRequester(async () => { throw Error('java.net.UnknownHostException'); }, async () => { throw Error('native reader offline'); });
  await assert.rejects(() => request(endpoint), /Check your connection and Expo Go/);
});
