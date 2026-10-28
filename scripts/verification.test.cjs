const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { load } = require('./test-support.cjs');

const fixture = () => {
  const root = pathToFileURL(mkdtempSync(join(tmpdir(), 'waylo-verification-')) + '/');
  mkdirSync(new URL('docs/verification/', root), { recursive: true });
  return root;
};
const environment = { EXPO_PUBLIC_SUPABASE_URL: 'https://unit-test.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit_test' };
const quiet = { log() {}, error() {} };

test('verification: backend overwrites stale success for missing credentials on every run, without a request', async t => {
  const { runBackendVerification } = await import('../backend/verify-live.mjs');
  const root = fixture(), path = new URL('docs/verification/backend-live.json', root);
  const original = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Unexpected live request'); }; t.after(() => { global.fetch = original; });
  for (let attempt = 0; attempt < 2; attempt++) {
    writeFileSync(path, JSON.stringify({ status: 'PASSED', checkedAt: '2000-01-01', checks: [{ name: 'old success', status: 'passed' }] }));
    const result = await runBackendVerification({ root, env: environment, authenticated: true, loadLocalEnvironment: false, ...quiet });
    const report = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(result.exitCode, 2); assert.equal(report.status, 'BLOCKED'); assert.notEqual(report.checkedAt, '2000-01-01');
    assert.deepEqual(report.checks, []); assert.ok(report.blocked.includes('WAYLO_TEST_OWNER_PASSWORD'));
    assert.equal(report.authenticatedLive, 'not performed'); assert.equal(calls, 0);
  }
});

test('verification: backend refuses authenticated work without explicit opt-in even with all credential fields', async () => {
  const { runBackendVerification } = await import('../backend/verify-live.mjs');
  const env = { ...environment };
  for (const role of ['OWNER', 'EDITOR', 'VIEWER', 'OUTSIDER']) { env[`WAYLO_TEST_${role}_EMAIL`] = `${role.toLowerCase()}@example.test`; env[`WAYLO_TEST_${role}_PASSWORD`] = 'controlled-fixture-only'; }
  const { report, exitCode } = await runBackendVerification({ root: fixture(), env, loadLocalEnvironment: false, ...quiet });
  assert.equal(exitCode, 2); assert.equal(report.status, 'BLOCKED'); assert.match(report.blocked[0], /explicit --authenticated/);
  assert.equal(report.authenticatedLive, 'not performed'); assert.doesNotMatch(JSON.stringify(report), /controlled-fixture-only|@example.test|sb_publishable_unit_test/);
});

test('verification: setup failure refreshes a sanitized FAILED report', async () => {
  const { runBackendVerification } = await import('../backend/verify-live.mjs');
  const root = fixture(); const env = { get EXPO_PUBLIC_SUPABASE_URL() { throw new Error('private-config-value'); } };
  const { exitCode, report } = await runBackendVerification({ root, env, loadLocalEnvironment: false, ...quiet });
  assert.equal(exitCode, 1); assert.equal(report.status, 'FAILED');
  assert.equal(JSON.parse(readFileSync(new URL('docs/verification/backend-live.json', root))).status, 'FAILED');
  assert.doesNotMatch(JSON.stringify(report), /private-config-value/);
});

test('verification: admin also overwrites stale success and remains blocked without opt-in', async () => {
  const { runAdminVerification } = await import('../admin/verify-live.mjs');
  const root = fixture(), path = new URL('docs/verification/admin-live.json', root);
  writeFileSync(path, JSON.stringify({ status: 'PASSED', checks: ['old success'] }));
  const { report, exitCode } = await runAdminVerification({ root, env: environment, ...quiet });
  assert.equal(exitCode, 2); assert.equal(report.status, 'BLOCKED'); assert.deepEqual(report.checks, []);
  assert.equal(JSON.parse(readFileSync(path)).authenticatedLive, 'not performed');
  assert.ok(report.blocked.includes('ADMIN_TEST_PASSWORD'));
});

test('verification: private admin test env can only override credentials and preserves exact password text', async () => {
  const { verificationEnvironment, missingLiveCredentials } = await import('../admin/verification.mjs');
  const base = { ADMIN_ORIGIN: 'http://127.0.0.1:8788', EXPO_PUBLIC_SUPABASE_URL: environment.EXPO_PUBLIC_SUPABASE_URL };
  const env = verificationEnvironment(base, { ADMIN_ORIGIN: 'https://untrusted.example.test', EXPO_PUBLIC_SUPABASE_URL: 'https://untrusted.example.test', ADMIN_TEST_PASSWORD: ' spaces preserved ', ADMIN_TEST_EMAIL: 'admin@example.test' });
  assert.equal(env.ADMIN_ORIGIN, base.ADMIN_ORIGIN); assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, base.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(env.ADMIN_TEST_PASSWORD, ' spaces preserved '); assert.deepEqual(missingLiveCredentials(env), ['ADMIN_NORMAL_TEST_EMAIL', 'ADMIN_NORMAL_TEST_PASSWORD']);
});

test('verification: database denial requires 42501, not a bad key, missing schema or outage', async () => {
  const { assertPermissionDenied } = await import('../backend/verification.mjs');
  for (const status of [401, 403]) assert.doesNotThrow(() => assertPermissionDenied(status, { code: '42501' }));
  for (const [status, body] of [[200, []], [401, { message: 'Invalid API key' }], [403, {}], [404, { code: 'PGRST202' }], [503, { code: '42501' }], [0, null]]) assert.throws(() => assertPermissionDenied(status, body));
});

async function controlledPublicRun(badKey = false) {
  const { runPublicVerification } = await import('../backend/verify-public.mjs');
  const calls = [], root = fixture();
  const fetcher = async (value, init = {}) => {
    const url = new URL(value); calls.push({ url, init });
    if (url.hostname === 'unit-test.supabase.co') {
      if (url.pathname === '/auth/v1/settings') return Response.json({ external: { email: true }, disable_signup: false, mailer_autoconfirm: false });
      return Response.json(badKey ? { message: 'Invalid API key' } : { code: '42501' }, { status: 401 });
    }
    if (url.port === '8787') return Response.json(url.pathname === '/health' ? { service: 'waylo-assistant' } : { configured: false }, { status: url.pathname === '/health' ? 200 : 503 });
    if (url.pathname === '/health') return Response.json({ service: 'waylo-admin' });
    if (url.pathname === '/ready') return Response.json({ databaseVerified: false });
    if (url.pathname === '/api/session') return Response.json({ user: null });
    if (url.pathname === '/api/logout') return Response.json({ error: 'Origin denied' }, { status: 403 });
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Sign in' }, { status: 401 });
    if (['/', '/app.js', '/model.mjs', '/style.css'].includes(url.pathname)) return new Response('controlled public asset', { headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "frame-ancestors 'none'" } });
    return Response.json({ error: 'Not found' }, { status: 404 });
  };
  const result = await runPublicVerification({ root, env: environment, serverEnv: {}, fetcher, log() {} });
  return { ...result, calls, root };
}

test('verification: controlled public checks make no authenticated, AI, invitation or mutation RPC requests', async () => {
  const { report, exitCode, calls } = await controlledPublicRun();
  assert.equal(exitCode, 0); assert.equal(report.status, 'PASSED'); assert.equal(report.authenticatedLive, 'not performed');
  assert.equal(report.checks.length, 8);
  for (const { url, init } of calls) {
    assert.doesNotMatch(url.pathname, /\/auth\/v1\/(?:token|signup|invite)|\/packing-chat$/);
    if (url.hostname === 'unit-test.supabase.co') {
      assert.equal(init.headers.Authorization, undefined);
      assert.ok(!init.method || init.method === 'POST' && /\/rpc\/waylo_(?:status|admin_(?:status|overview|users|trips|trip))$/.test(url.pathname));
    }
  }
});

test('verification: controlled public API-key errors fail and persist a fresh report instead of proving denial', async () => {
  const { report, exitCode, root } = await controlledPublicRun(true);
  assert.equal(exitCode, 1); assert.equal(report.status, 'FAILED'); assert.equal(report.failures.length, 2);
  assert.equal(JSON.parse(readFileSync(new URL('docs/verification/public-security-current.json', root))).status, 'FAILED');
});

test('verification: admin visibility must match canonical profile, identity, confirmation, version and role', async () => {
  const { assertProfileVisibility } = await import('../backend/verification.mjs');
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'ari@example.test', email_confirmed_at: '2026-10-27T10:00:00Z', user_metadata: { is_admin: true } };
  const profile = { user_id: user.id, full_name: 'Ari Santos', home_city: 'Lisbon', updated_at: '2026-10-28T10:00:00Z' };
  const row = { id: user.id, email: 'ARI@example.test', email_confirmed_at: '2026-10-27T10:00:00+00:00', full_name: profile.full_name, home_city: profile.home_city, profile_updated_at: '2026-10-28T10:00:00.000Z', is_admin: false };
  assert.doesNotThrow(() => assertProfileVisibility(row, user, profile, false));
  for (const patch of [{ id: 'different-user' }, { email: 'different@example.test' }, { full_name: 'Invented name' }, { home_city: 'Other' }, { email_confirmed_at: null }, { profile_updated_at: null }, { profile_updated_at: '2026-10-27T10:00:00Z' }, { is_admin: true }, { demo: true }]) assert.throws(() => assertProfileVisibility({ ...row, ...patch }, user, profile, false));
  assert.throws(() => assertProfileVisibility(row, user, { user_id: user.id }, false));
  assert.throws(() => assertProfileVisibility(row, { ...user, email_confirmed_at: null }, profile, false));
});

test('verification: assistant diagnostic agrees with the app and never serializes URL credentials', async () => {
  const { assistantEndpointConfig } = await import('../backend/config.mjs');
  const { assistantUrl } = load('src/lib/service-connection.ts');
  for (const value of [undefined, '', 'invalid', 'http://example.test/packing-chat', 'https://localhost/packing-chat', 'https://example.test', 'https://example.test/packing-chat/', 'https://user:private@example.test/packing-chat', 'https://example.test/packing-chat?private=value', 'https://example.test/packing-chat#private']) {
    const result = assistantEndpointConfig(value); assert.equal(result.valid, false); assert.equal(result.url, null); assert.ok(result.issue);
    assert.equal(assistantUrl(value), null); assert.doesNotMatch(JSON.stringify(result), /user:private|private=value|#private/);
  }
  const result = assistantEndpointConfig('https://assistant.example.test/packing-chat'); assert.equal(result.valid, true); assert.equal(result.issue, null);
  assert.equal(result.url, assistantUrl(result.url));
});

test('verification: all prepared migrations match reviewed source; SQL retains RLS and least privilege', () => {
  const pairs = [['supabase.sql', '20261026000100_waylo_backend.sql'], ['admin.sql', '20261026000200_waylo_admin.sql'], ['auth-profiles.sql', '20261027000100_waylo_auth_profiles.sql'], ['user-management.sql', '20261027000200_waylo_user_management.sql']];
  for (const [source, target] of pairs) assert.equal(readFileSync(`backend/${source}`, 'utf8'), readFileSync(`supabase/migrations/${target}`, 'utf8'));
  const mobile = readFileSync('backend/supabase.sql', 'utf8'), admin = readFileSync('backend/admin.sql', 'utf8'), profiles = readFileSync('backend/auth-profiles.sql', 'utf8'), management = readFileSync('backend/user-management.sql', 'utf8');
  for (const table of ['rooms', 'members', 'invites', 'backups']) assert.match(mobile, new RegExp(`alter table public.waylo_${table} enable row level security`));
  for (const table of ['admins', 'admin_audit']) assert.match(admin, new RegExp(`alter table public.waylo_${table} enable row level security`));
  assert.match(profiles, /alter table public.waylo_profiles enable row level security/);
  assert.match(profiles, /for select to authenticated using\(user_id=auth.uid\(\)\)/);
  assert.match(profiles, /grant update\(full_name,home_city\)/);
  assert.doesNotMatch(profiles + management, /(?:insert into|update) public\.waylo_admins/i);
  const definition = admin.split('function public.waylo_is_admin()')[1].split('$$;')[0];
  assert.match(definition, /user_id=auth.uid\(\) and active/); assert.doesNotMatch(definition, /raw_user_meta_data|full_name/);
  for (const sql of [admin, profiles, management]) for (const match of sql.matchAll(/create or replace function public\.(waylo_admin_\w+)\([^]*?\$\$;\s*/g)) {
    if (match[1] === 'waylo_admin_room_summary') continue; // Internal helper has no client EXECUTE grant.
    assert.match(match[0], /security definer set search_path=''/); assert.match(match[0], /perform public.waylo_require_admin\(\)/);
  }
});
