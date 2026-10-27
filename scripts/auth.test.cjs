const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./test-support.cjs');
const policy = load('src/lib/auth-policy.ts');
const { createSecureAuthStorage } = load('src/lib/auth-storage.ts');
const registration = (patch = {}) => ({ fullName: 'Ari Santos', email: 'ari@example.com', password: 'a long unique password', confirmation: 'a long unique password', ...patch });
const allowed = ['waylo://auth/callback', 'http://127.0.0.1:8081/auth/callback', 'exp://192.168.1.5:8081/--/auth/callback'];
const tokens = 'access_token=' + 'a'.repeat(40) + '&refresh_token=' + 'b'.repeat(24) + '&type=recovery';

test('auth validation: registration and recovery validate new passwords; legacy login remains usable', () => {
  assert.equal(policy.registrationIssue(registration()), '');
  assert.match(policy.registrationIssue(registration({ fullName: ' ' })), /name/);
  assert.match(policy.registrationIssue(registration({ fullName: 'Name\nAdmin' })), /name/);
  assert.match(policy.registrationIssue(registration({ email: 'not-an-email' })), /email/);
  assert.match(policy.passwordIssue('short', 'short'), /8 characters/);
  assert.match(policy.passwordIssue('longpassword', 'different'), /do not match/);
  assert.match(policy.passwordIssue('🔒'.repeat(20), '🔒'.repeat(20)), /72 UTF-8/);
  assert.equal(policy.loginIssue('ari@example.com', 'legacy'), '');
  assert.equal(policy.cleanEmail('  ARI@Example.com '), 'ari@example.com');
});
test('auth callback: accepts only exact app destinations and fragment bearer credentials', () => {
  for (const destination of allowed) assert.equal(policy.parseAuthCallback(destination + '#' + tokens, allowed).kind, 'tokens');
  for (const destination of ['https://attacker.example/auth/callback', 'waylo://evil/callback', 'waylo://auth/elsewhere', 'http://127.0.0.1:8082/auth/callback', 'http://user:pass@127.0.0.1:8081/auth/callback']) assert.equal(policy.parseAuthCallback(destination + '#' + tokens, allowed).kind, 'error');
  assert.equal(policy.parseAuthCallback(allowed[1] + '?' + tokens, allowed).kind, 'error');
  assert.equal(policy.parseAuthCallback(allowed[0] + '#' + tokens + '&access_token=shadowed', allowed).kind, 'error');
  assert.equal(policy.parseAuthCallback(allowed[0] + '?code=' + 'x'.repeat(30) + '#' + tokens, allowed).kind, 'error');
});
test('auth callback: distinguishes recovery, PKCE, token hashes and safe expired-link errors', () => {
  assert.equal(policy.parseAuthCallback(allowed[0] + '#' + tokens, allowed).recovery, true);
  assert.deepEqual(policy.parseAuthCallback(allowed[1] + '?code=' + 'c'.repeat(30), allowed), { kind: 'code', code: 'c'.repeat(30), recovery: false });
  assert.equal(policy.parseAuthCallback(allowed[1] + '?token_hash=' + 'd'.repeat(64) + '&type=recovery', allowed).recovery, true);
  assert.equal(policy.parseAuthCallback(allowed[1] + '?token_hash=' + 'd'.repeat(64) + '&type=signup', allowed).type, 'email');
  assert.match(policy.parseAuthCallback(allowed[1] + '#error=access_denied&error_code=otp_expired&error_description=secret-should-not-render', allowed).message, /expired/);
  assert.doesNotMatch(policy.parseAuthCallback(allowed[1] + '#error=access_denied&error_code=otp_expired&error_description=secret-should-not-render', allowed).message, /secret-should/);
});
test('auth errors distinguish confirmation, rate limits, setup and offline without provider-body disclosure', () => {
  assert.match(policy.authMessage({ code: 'email_not_confirmed' }), /Confirm your email/);
  assert.match(policy.authMessage({ code: 'over_email_send_rate_limit' }), /Too many/);
  assert.match(policy.authMessage({ code: 'PGRST205' }), /migration/);
  assert.match(policy.authMessage(new TypeError('fetch failed')), /connection/);
  assert.doesNotMatch(policy.authMessage({ code: 'unexpected', message: 'sensitive provider body' }), /sensitive/);
});
const vault = () => { const values = new Map(); return { values, getItemAsync: async (key) => values.get(key) ?? null, setItemAsync: async (key, value) => { assert.ok(Buffer.byteLength(value) <= 1800); values.set(key, value); }, deleteItemAsync: async (key) => { values.delete(key); } }; };
test('secure session: existing legacy sessions survive and long Unicode sessions stay entirely in the vault', async () => {
  const disk = vault(); disk.values.set('session', 'old-session'); const adapter = createSecureAuthStorage(disk);
  assert.equal(await adapter.getItem('session'), 'old-session');
  const large = JSON.stringify({ token: 'x'.repeat(6500), name: '旅🌏'.repeat(180) });
  await adapter.setItem('session', large); assert.equal(await adapter.getItem('session'), large);
  assert.equal(disk.values.has('session'), false); assert.ok(disk.values.size > 3);
  assert.equal(await createSecureAuthStorage(disk).getItem('session'), large);
});
test('secure session: a failed write preserves the last committed session', async () => {
  const disk = vault(); const adapter = createSecureAuthStorage(disk); await adapter.setItem('session', 'good');
  const original = disk.setItemAsync; let writes = 0; disk.setItemAsync = async (key, value) => { if (++writes === 2) throw Error('secure write failed'); await original(key, value); };
  await assert.rejects(adapter.setItem('session', 'x'.repeat(5000)), /secure write failed/);
  assert.equal(await adapter.getItem('session'), 'good');
});
test('secure session: concurrent rotation/logout are ordered, and stale legacy values cannot resurrect a session', async () => {
  const disk = vault(); const adapter = createSecureAuthStorage(disk);
  await Promise.all([adapter.setItem('session', 'one'), adapter.setItem('session', 'two'), adapter.removeItem('session')]);
  disk.values.set('session', 'stale'); assert.equal(await adapter.getItem('session'), null);
  assert.equal(await createSecureAuthStorage(disk).getItem('session'), null);
  await adapter.setItem('session', 'new-sign-in'); assert.equal(await adapter.getItem('session'), 'new-sign-in');
});
test('secure session: incomplete or tampered manifests fail closed, and a fresh login can recover', async () => {
  const disk = vault(); const adapter = createSecureAuthStorage(disk);
  disk.values.set('session.manifest', '{bad'); await assert.rejects(adapter.getItem('session'));
  await adapter.setItem('session', 'recovered'); assert.equal(await adapter.getItem('session'), 'recovered');
  const manifest = JSON.parse(disk.values.get('session.manifest')); disk.values.delete(manifest.keys[0]);
  await assert.rejects(adapter.getItem('session'), /incomplete/);
  disk.values.set('session.manifest', JSON.stringify({ version: 1, keys: ['unrelated.key'] }));
  await assert.rejects(adapter.getItem('session'), /invalid/);
  disk.values.set('unrelated.key', 'keep'); await adapter.removeItem('session'); assert.equal(disk.values.get('unrelated.key'), 'keep');
});
test('cloud profiles: account identity never uses a sample name or derives privileges from editable profile fields', () => {
  assert.equal(policy.accountIdentity(null, 'ari@example.com').name, 'ari');
  assert.equal(policy.accountIdentity({ full_name: ' Ari Santos ', home_city: 'Lisbon' }, 'ari@example.com').name, 'Ari Santos');
  const sql = fs.readFileSync('backend/auth-profiles.sql', 'utf8');
  assert.match(sql, /after insert on auth.users/);
  assert.match(sql, /using\(user_id=auth.uid\(\)\)/);
  assert.match(sql, /grant update\(full_name,home_city\)/);
  assert.match(sql, /perform public.waylo_require_admin\(\)/);
  assert.doesNotMatch(sql, /insert into public.waylo_admins|update public.waylo_admins|grant .*service_role/i);
  assert.equal(fs.readFileSync('supabase/migrations/20261027000100_waylo_auth_profiles.sql', 'utf8'), sql);
});
test('admin user names are real optional profile fields and remain escaped at presentation', async () => {
  const { userIdentity, escapeHtml } = await import('../admin/public/model.mjs');
  assert.deepEqual(userIdentity({ email: 'ari@example.com', full_name: 'Ari Santos', home_city: 'Lisbon' }), { name: 'Ari Santos', email: 'ari@example.com', displayName: 'Ari Santos', initials: 'AS', homeCity: 'Lisbon' });
  assert.equal(userIdentity({ email: 'old@example.com' }).name, '');
  assert.equal(userIdentity({ full_name: { role: 'admin' } }).name, '');
  assert.equal(escapeHtml(userIdentity({ full_name: '<script>' }).displayName), '&lt;script&gt;');
});
