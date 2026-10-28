// Opt-in acceptance against YOUR deployed services, never fixtures or invented tokens.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isDeepStrictEqual, parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { httpsUrl, publicSupabaseKey, assistantEndpointConfig } from './config.mjs';
import { verificationReport, saveVerificationReport, assertPermissionDenied } from './verification.mjs';

export async function runBackendVerification({ root = new URL('../', import.meta.url), env = process.env, authenticated = false, loadLocalEnvironment = true, log = console.log, error = console.error } = {}) {
const reportPath = new URL('docs/verification/backend-live.json', root);
const report = { ...verificationReport(), ai: 'not requested', cleanup: 'No test records created' };
let exitCode = 0;
// Invalidate older success evidence before configuration or network checks.
saveVerificationReport(reportPath, report);
try { await verify(); }
catch { report.status = 'FAILED'; report.checks.push({ name: 'verification setup', status: 'failed' }); error('FAIL: verification setup. No credentials or provider bodies were logged.'); exitCode = 1; }
finally { saveVerificationReport(reportPath, report); }
return { report, exitCode };

async function verify() {
const file = (name) => loadLocalEnvironment && existsSync(new URL(name, root)) ? parseEnv(readFileSync(new URL(name, root), 'utf8')) : {};
const base = { ...file('.env.local'), ...env };
const local = file('backend/verification.env.local');
// Test credentials must not silently redirect the project or the AI endpoint.
env = { ...base, ...Object.fromEntries(Object.entries(local).filter(([name]) => /^WAYLO_TEST_(OWNER|EDITOR|VIEWER|OUTSIDER)_(EMAIL|PASSWORD)$/.test(name) || name === 'WAYLO_VERIFY_AI')) };
const url = httpsUrl(env.EXPO_PUBLIC_SUPABASE_URL, { root: true });
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const roles = ['OWNER', 'EDITOR', 'VIEWER', 'OUTSIDER'];
const missing = [];
if (!url) missing.push('EXPO_PUBLIC_SUPABASE_URL');
if (!publicSupabaseKey(key)) missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy anon key)');
for (const role of roles) for (const field of ['EMAIL', 'PASSWORD']) if (!env[`WAYLO_TEST_${role}_${field}`]?.trim()) missing.push(`WAYLO_TEST_${role}_${field}`);
if (!authenticated) report.blocked.push('Authenticated checks require explicit --authenticated opt-in; not authorized for the current audit');
report.blocked.push(...missing);
if (report.blocked.length) { log(`Live verification BLOCKED: ${report.blocked.join(', ')}. No services were called.`); exitCode = 2; return; }
const ai = env.WAYLO_VERIFY_AI === '1';
report.ai = ai ? 'requested' : 'not requested';
const assistant = assistantEndpointConfig(env.EXPO_PUBLIC_ASSISTANT_URL), endpoint = assistant.url;
if (ai && !assistant.valid) {
  report.blocked.push('Configure a phone-reachable HTTPS /packing-chat endpoint');
  log('Live AI verification BLOCKED: configure a phone-reachable HTTPS /packing-chat endpoint.'); exitCode = 2; return;
}
const fetchWithTimeout = (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchWithTimeout } });
const clients = roles.map(() => client());
const [owner, editor, viewer, outsider] = clients;
const anonymous = client();
let step = 'sign in'; let roomId; let backupWritten = false; let ownerId; let success = false;
const ensure = (condition) => { if (!condition) throw new Error('Acceptance assertion failed'); };
const check = (name) => { report.checks.push({ name, status: 'passed' }); log(`PASS: ${name}`); };
const rpc = async (c, name, args = {}) => { const result = await c.rpc(name, args); ensure(!result.error); return result.data; };
try {
  report.authenticatedLive = 'started with explicit opt-in';
  const users = [];
  for (let i = 0; i < roles.length; i++) {
    const { data, error } = await clients[i].auth.signInWithPassword({ email: env[`WAYLO_TEST_${roles[i]}_EMAIL`], password: env[`WAYLO_TEST_${roles[i]}_PASSWORD`] });
    ensure(!error && data.user && data.session); users.push(data.user);
  }
  ensure(new Set(users.map((u) => u.id)).size === 4); ownerId = users[0].id; check('Four distinct existing accounts authenticate');
  step = 'schema and clean test account';
  const status = await rpc(owner, 'waylo_status'); ensure(status.schema === 1 && status.collaboration && status.backup);
  // A test must never replace somebody's existing manual account backup.
  const existing = await owner.from('waylo_backups').select('user_id').eq('user_id', ownerId);
  ensure(!existing.error && existing.data.length === 0); check('Schema installed; owner test account has no existing backup');
  const require = createRequire(import.meta.url);
  const { load } = require('../scripts/test-support.cjs');
  const { createTrip, parseTravelState } = load('src/lib/travel-state.ts');
  const { assistantContext, parseAssistantReply } = load('src/lib/assistant.ts');
  const { exportTrip, exportBackup, readPortable } = load('src/lib/portable-data.ts');
  const state = parseTravelState(null);
  const trip = createTrip('bali', `Waylo backend acceptance ${Date.now()}`, '2099-06-01'); state.trips = [trip];
  const portable = JSON.parse(exportTrip(state, trip));
  const document = { schema: 1, trip: portable.data.trips[0], bags: portable.data.bags, places: portable.data.customPlaces };
  step = 'shared trip creation and persistence';
  const created = await rpc(owner, 'waylo_create_room', { content: document }); roomId = created.id;
  ensure(created.owner === ownerId && created.revision === 1);
  const fetched = await owner.from('waylo_rooms').select('*').eq('id', roomId).single();
  ensure(!fetched.error && isDeepStrictEqual(fetched.data.document.trip, document.trip));
  // Validate the stored document with the same portable parser used by the app.
  readPortable(JSON.stringify({ ...portable, data: { ...portable.data, trips: [fetched.data.document.trip] } }));
  check('Create and reload an actual app trip from Supabase');
  step = 'anonymous and outsider isolation';
  const anonRead = await anonymous.from('waylo_rooms').select('id').eq('id', roomId);
  assertPermissionDenied(anonRead.status, anonRead.error);
  const outsiderRead = await outsider.from('waylo_rooms').select('id').eq('id', roomId);
  ensure(!outsiderRead.error && Array.isArray(outsiderRead.data) && outsiderRead.data.length === 0);
  const bypass = await owner.from('waylo_rooms').update({ document }).eq('id', roomId).select('id'); ensure(bypass.error || !bypass.data.length);
  check('Anonymous/outsider reads and direct client writes blocked');
  step = 'viewer permissions';
  const viewerCode = await rpc(owner, 'waylo_invite', { room: roomId, access_role: 'viewer' });
  const viewed = await rpc(viewer, 'waylo_join', { invitation: viewerCode.toUpperCase() }); ensure(viewed.id === roomId);
  ensure((await viewer.rpc('waylo_publish', { room: roomId, expected_revision: 1, content: document })).error);
  ensure((await viewer.rpc('waylo_delete_room', { room: roomId })).error); check('Viewer can join/read, cannot publish/delete');
  step = 'editor and revision conflict';
  const editorCode = await rpc(owner, 'waylo_invite', { room: roomId, access_role: 'editor' });
  await rpc(editor, 'waylo_join', { invitation: editorCode });
  const edited = { ...document, trip: { ...document.trip, title: `${trip.title} edited` } };
  const published = await rpc(editor, 'waylo_publish', { room: roomId, expected_revision: 1, content: edited }); ensure(published.revision === 2);
  const reloaded = await owner.from('waylo_rooms').select('document,revision').eq('id', roomId).single();
  ensure(!reloaded.error && reloaded.data.document.trip.title === edited.trip.title && reloaded.data.revision === 2);
  const stale = await owner.rpc('waylo_publish', { room: roomId, expected_revision: 1, content: document }); ensure(stale.error?.message.includes('revision_conflict'));
  check('Editor changes persist across accounts; stale revision rejected');
  step = 'revocation';
  await rpc(owner, 'waylo_revoke', { room: roomId, member: users[1].id });
  const revoked = await editor.from('waylo_rooms').select('id').eq('id', roomId); ensure(!revoked.error && revoked.data.length === 0);
  ensure((await editor.rpc('waylo_publish', { room: roomId, expected_revision: 2, content: document })).error);
  await rpc(owner, 'waylo_revoke', { room: roomId });
  ensure((await outsider.rpc('waylo_join', { invitation: viewerCode })).error); check('Membership and invitation revocation enforced');
  step = 'private manual backup';
  const backup = exportBackup(state);
  const uploaded = await owner.from('waylo_backups').insert({ user_id: ownerId, document: backup }); ensure(!uploaded.error); backupWritten = true;
  const restored = await owner.from('waylo_backups').select('document').eq('user_id', ownerId).single(); ensure(!restored.error); readPortable(restored.data.document); ensure(restored.data.document === backup);
  const otherRead = await viewer.from('waylo_backups').select('document').eq('user_id', ownerId); ensure(!otherRead.error && otherRead.data.length === 0);
  const otherWrite = await viewer.from('waylo_backups').upsert({ user_id: ownerId, document: backup }); ensure(otherWrite.error);
  const otherDelete = await viewer.from('waylo_backups').delete().eq('user_id', ownerId).select('user_id'); ensure(otherDelete.error || !otherDelete.data.length);
  check('Backup round trip works; other account cannot read/write/delete it');
  if (ai) {
    step = 'one real AI request';
    const { data } = await owner.auth.getSession();
    const response = await fetchWithTimeout(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ context: assistantContext(trip), messages: [{ role: 'user', content: 'Ask one short question about my laundry preferences. Do not suggest any list changes yet.' }], language: 'en' }) });
    ensure(response.ok); parseAssistantReply(await response.json(), trip); report.ai = 'passed'; check('Real authenticated AI reply matches the app schema');
  }
  step = 'owner deletion'; await rpc(owner, 'waylo_delete_room', { room: roomId });
  const deleted = await owner.from('waylo_rooms').select('id').eq('id', roomId); ensure(!deleted.error && !deleted.data.length); roomId = null; check('Owner deletes the test room');
  success = true;
  report.status = 'PASSED'; report.authenticatedLive = 'passed';
} catch {
  report.status = 'FAILED'; report.authenticatedLive = 'failed';
  report.checks.push({ name: step, status: 'failed' }); error(`FAIL: ${step}. Check service configuration and the installed migration. Credentials/provider bodies were not logged.`);
} finally {
  let clean = true;
  if (roomId) { const result = await Promise.resolve(owner.rpc('waylo_delete_room', { room: roomId })).catch(() => ({ error: true })); clean &&= !result.error; }
  if (backupWritten) { const result = await Promise.resolve(owner.from('waylo_backups').delete().eq('user_id', ownerId)).catch(() => ({ error: true })); clean &&= !result.error; }
  report.cleanup = clean ? 'test records removed' : 'failed; remove the acceptance room/backup from the OWNER test account';
  await Promise.allSettled(clients.map((c) => c.auth.signOut({ scope: 'local' })));
  log(`Cleanup: ${report.cleanup}. Physical-phone interaction remains a separate check.`);
  if (!success || !clean) { report.status = 'FAILED'; exitCode = 1; }
}
}
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await runBackendVerification({ authenticated: process.argv.includes('--authenticated') });
  process.exitCode = result.exitCode;
}
