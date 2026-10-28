const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { withDeadline, createTimedFetch } = load('src/lib/async-deadline.ts');
const never = () => new Promise(() => {});

test('auth deadline rejects unfinished work, preserves errors and ignores late success', async () => {
  assert.equal(await withDeadline(Promise.resolve('done'), 100, 'timeout'), 'done');
  const cause = new Error('original');
  await assert.rejects(withDeadline(Promise.reject(cause), 100, 'timeout'), error => error === cause);
  let complete;
  const work = new Promise(resolve => { complete = resolve; });
  const result = withDeadline(work, 5, 'timeout');
  await assert.rejects(result, /timeout/);
  complete('late');
  await assert.rejects(result, /timeout/);
});

test('account fetch aborts a stalled transport and never returns its late response', async () => {
  let signal, complete;
  const request = createTimedFetch(async (_input, options) => {
    signal = options.signal;
    return new Promise(resolve => { complete = resolve; });
  }, 5)('https://example.invalid/auth/v1/verify', { method: 'POST' });
  await assert.rejects(request, /timed out/);
  assert.equal(signal.aborted, true);
  complete(new Response('{"session":"must not be accepted"}'));
  await assert.rejects(request, /timed out/);
});

test('account fetch bounds a stalled response body, not only headers', async () => {
  let signal;
  const fetcher = createTimedFetch(async (_input, options) => {
    signal = options.signal;
    return { text: never, status: 200, statusText: 'OK', headers: new Headers() };
  }, 5);
  await assert.rejects(fetcher('https://example.invalid/auth/v1/token'), /timed out/);
  assert.equal(signal.aborted, true);
});

test('account fetch preserves provider HTTP errors, JSON and headers without treating them as sessions', async () => {
  const request = createTimedFetch(async (_input, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.body, 'request');
    assert.equal(options.headers.apikey, 'public-test-key');
    return new Response('{"code":"otp_expired"}', { status: 403, headers: { 'retry-after': '60', 'content-type': 'application/json' } });
  });
  const result = await request('https://example.invalid/auth/v1/verify', { method: 'POST', body: 'request', headers: { apikey: 'public-test-key' } });
  assert.equal(result.status, 403);
  assert.equal(result.ok, false);
  assert.equal(result.headers.get('retry-after'), '60');
  assert.deepEqual(await result.json(), { code: 'otp_expired' });
});

test('account fetch forwards cancellation and supports body-free responses', async () => {
  const controller = new AbortController();
  const fetcher = createTimedFetch(async (_input, options) => {
    assert.equal(options.signal.aborted, true);
    throw new DOMException('Aborted', 'AbortError');
  });
  controller.abort();
  await assert.rejects(fetcher('https://example.invalid/auth/v1/token', { signal: controller.signal }), { name: 'AbortError' });
  const empty = await createTimedFetch(async () => new Response(null, { status: 204 }))('https://example.invalid/auth/v1/logout');
  assert.equal(empty.status, 204);
  assert.equal(await empty.text(), '');
});
