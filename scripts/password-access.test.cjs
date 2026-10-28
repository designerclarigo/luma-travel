const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { passwordAccess } = load('src/lib/password-access.ts');
const input = { signup: false, email: ' PERSON@example.test ', password: 'test only password', name: '', redirectTo: 'waylo://auth/callback' };
function client(result) { const calls = []; return { calls, auth: { signInWithPassword: async args => { calls.push(['password',args]); return result; }, signUp: async args => { calls.push(['signup',args]); return result; } } }; }
test('password access: a confirmed real-provider session is required for direct login; password is not trimmed', async () => {
  const c = client({ data: { session: { user: { email_confirmed_at: '2026-10-27' } } }, error: null });
  assert.equal(await passwordAccess(c,{ ...input, password: ' keep spaces ' }), 'signed-in');
  assert.deepEqual(c.calls, [['password',{ email: 'person@example.test', password: ' keep spaces ' }]]);
  for (const session of [null,{ user: { email_confirmed_at: null } }]) await assert.rejects(passwordAccess(client({ data: { session }, error: null }), input), /verified sign-in/);
});
test('password registration: sends minimal profile metadata, never an admin role, and requires confirmation without a session', async () => {
  const c = client({ data: { user: { id: 'provider-id' }, session: null }, error: null });
  assert.equal(await passwordAccess(c,{ ...input, signup: true, name: ' Priya ', confirmation: input.password }), 'verification-sent');
  assert.deepEqual(c.calls, [['signup',{ email: 'person@example.test', password: input.password, options: { emailRedirectTo: input.redirectTo, data: { full_name: 'Priya' } } }]]);
});
test('password access: unconfirmed, invalid credentials, rate limits and validation never become successful login', async () => {
  const c = client({ data: {}, error: { code: 'email_not_confirmed' } });
  assert.equal(await passwordAccess(c,input), 'confirmation-needed');
  for (const code of ['invalid_credentials','over_email_send_rate_limit','unknown']) await assert.rejects(passwordAccess(client({ data: {}, error: { code, message: 'provider secret body' } }), input), e => !e.message.includes('provider secret body'));
  const untouched = client({});
  await assert.rejects(passwordAccess(untouched,{ ...input, email: 'invalid' }),/email/);
  await assert.rejects(passwordAccess(untouched,{ ...input, signup: true, name: 'Priya', password: 'short', confirmation: 'short' }),/8 characters/);
  assert.equal(untouched.calls.length, 0);
});
test('registration requires a name and matching confirmation before contacting Supabase', async () => {
  const untouched = client({});
  for (const name of ['', ' ', 'A', 'A\nB']) await assert.rejects(passwordAccess(untouched, { ...input, signup: true, name, confirmation: input.password }), /name/);
  for (const confirmation of ['', 'different password']) await assert.rejects(passwordAccess(untouched, { ...input, signup: true, name: 'Priya', confirmation }), /do not match/);
  assert.equal(untouched.calls.length, 0);
});
