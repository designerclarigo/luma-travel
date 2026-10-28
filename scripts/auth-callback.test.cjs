const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { load } = require('./test-support.cjs');

// Exercise the production service with controlled platform/client adapters, never real tokens.
function service(t, client) {
  const history = []; const priorWindow = global.window; const priorDocument = global.document;
  global.window = { history: { replaceState: (_state, _title, path) => history.push(path) } };
  global.document = { title: 'Waylo' };
  t.after(() => { global.window = priorWindow; global.document = priorDocument; });
  const module = { exports: {} };
  const requireAdapter = name => {
    if (name === 'expo-linking') return { createURL: path => `http://127.0.0.1:8081/${path}` };
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === './cloud-client') return { requireCloud: () => { assert.deepEqual(history, ['/auth/callback']); return client; } };
    if (name === './auth-policy') return load('src/lib/auth-policy.ts');
    if (name === './async-deadline') return load('src/lib/async-deadline.ts');
    throw Error('Unexpected dependency');
  };
  const code = ts.transpileModule(fs.readFileSync('src/lib/auth-service.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(requireAdapter, module, module.exports);
  return { ...module.exports, history };
}

test('expired email callbacks scrub the URL and fail immediately without any auth request', async t => {
  const auth = service(t, { auth: new Proxy({}, { get() { assert.fail('Expired callbacks must never call Auth'); } }) });
  await assert.rejects(auth.finishAuthCallback('http://127.0.0.1:8081/auth/callback#error=access_denied&error_code=otp_expired&error_description=untrusted-provider-detail'), error => /expired/.test(error.message) && !error.message.includes('untrusted-provider-detail'));
  assert.deepEqual(auth.history, ['/auth/callback']);
});

test('confirmation callback requires the canonical verified user, never just a provider session', async t => {
  const calls = []; let confirmed = false;
  const auth = service(t, { auth: {
    verifyOtp: async args => { calls.push(args); return { data: { session: {} }, error: null }; },
    getUser: async () => ({ data: { user: { id: 'canonical-user', email_confirmed_at: confirmed ? '2026-10-28' : null } }, error: null }),
  } });
  const url = 'http://127.0.0.1:8081/auth/callback?token_hash=' + 't'.repeat(24) + '&type=signup';
  await assert.rejects(auth.finishAuthCallback(url), /couldn’t verify/);
  // Use a fresh history assertion for the next independent callback invocation.
  auth.history.length = 0; confirmed = true;
  assert.deepEqual(await auth.finishAuthCallback(url), { recovery: false, userId: 'canonical-user' });
  assert.deepEqual(calls, Array(2).fill({ token_hash: 't'.repeat(24), type: 'email' }));
});

test('PKCE recovery is recognized only after successful exchange and canonical user verification', async t => {
  const auth = service(t, { auth: {
    exchangeCodeForSession: async code => { assert.equal(code, 'test-code-for-unit-only'); return { data: { redirectType: 'recovery' }, error: null }; },
    getUser: async () => ({ data: { user: { id: 'verified-user', email_confirmed_at: '2026-10-28' } }, error: null }),
  } });
  assert.deepEqual(await auth.finishAuthCallback('http://127.0.0.1:8081/auth/callback?code=test-code-for-unit-only'), { recovery: true, userId: 'verified-user' });
});
