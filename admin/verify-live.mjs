// Read-only live acceptance. No user creation, grants, trip edits or deletion.
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { adminConfig, loadEnvironment } from './config.mjs';
import { verificationEnvironment, missingLiveCredentials } from './verification.mjs';
import { verificationReport, saveVerificationReport, assertPermissionDenied, assertProfileVisibility } from '../backend/verification.mjs';

export async function runAdminVerification({ root = new URL('../', import.meta.url), env, authenticated = false, log = console.log, error = console.error } = {}) {
const reportPath = new URL('docs/verification/admin-live.json', root);
const report = { ...verificationReport(), destructiveActions: 'not performed', browserInteraction: 'not tested by this command' };
let exitCode = 0;
saveVerificationReport(reportPath, report);
try { await verify(); }
catch { report.status = 'FAILED'; report.checks.push({ name: 'verification setup', status: 'failed' }); error('FAIL: verification setup. No secrets or provider bodies were printed.'); exitCode = 1; }
finally { saveVerificationReport(reportPath, report); }
return { report, exitCode };

async function verify() {
const testFile = new URL('admin/.env.test.local', root);
env = verificationEnvironment(env ?? loadEnvironment(), existsSync(testFile) ? parseEnv(readFileSync(testFile, 'utf8')) : {});
const config = adminConfig(env);
const missing = [...config.issues, ...missingLiveCredentials(env)];
if (!authenticated) report.blocked.push('Authenticated checks require explicit --authenticated opt-in; not authorized for the current audit');
report.blocked.push(...missing);
if (report.blocked.length) { log(`Live admin verification BLOCKED: ${report.blocked.join(', ')}. No services were called.`); exitCode = 2; return; }
let step = 'authenticate existing test accounts'; let admin; let normal; let cookie; let csrf;
const ensure = (condition) => { if (!condition) throw new Error('Acceptance assertion failed'); };
const pass = (name) => { report.checks.push({ name, status: 'passed' }); log(`PASS: ${name}`); };
const request = async (url, init = {}) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  const text = await response.text(); const body = text ? JSON.parse(text) : null; return { response, body };
};
const supabase = (path, body, access) => request(`${config.url}${path}`, { method: 'POST', headers: { apikey: config.key, 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) }, body: JSON.stringify(body) });
try {
  report.authenticatedLive = 'started with explicit opt-in';
  admin = await supabase('/auth/v1/token?grant_type=password', { email: env.ADMIN_TEST_EMAIL, password: env.ADMIN_TEST_PASSWORD }); ensure(admin.response.ok && admin.body.access_token);
  normal = await supabase('/auth/v1/token?grant_type=password', { email: env.ADMIN_NORMAL_TEST_EMAIL, password: env.ADMIN_NORMAL_TEST_PASSWORD }); ensure(normal.response.ok && normal.body.access_token && normal.body.user.id !== admin.body.user.id);
  ensure(admin.body.user.email_confirmed_at && normal.body.user.email_confirmed_at);
  step = 'database admin grants';
  const status = await supabase('/rest/v1/rpc/waylo_admin_status', {}, admin.body.access_token); ensure(status.response.ok && status.body.admin === true); pass('Existing admin grant and migration verified');
  for (const access of [null, normal.body.access_token]) {
    for (const name of ['waylo_admin_status', 'waylo_admin_overview', 'waylo_admin_users', 'waylo_admin_trips']) {
      const denied = await supabase(`/rest/v1/rpc/${name}`, {}, access); assertPermissionDenied(denied.response.status, denied.body);
    }
  }
  pass('Anonymous and normal users denied by database RPC permissions');
  step = 'canonical user/profile visibility';
  const profiles = [];
  for (const [index, auth] of [admin, normal].entries()) {
    const profile = await request(`${config.url}/rest/v1/waylo_profiles?select=user_id,full_name,home_city,updated_at&user_id=eq.${encodeURIComponent(auth.body.user.id)}`, { headers: { apikey: config.key, Authorization: `Bearer ${auth.body.access_token}` } });
    ensure(profile.response.ok && Array.isArray(profile.body) && profile.body.length === 1); profiles.push(profile.body[0]);
    const users = await supabase('/rest/v1/rpc/waylo_admin_users', { search_text: auth.body.user.email }, admin.body.access_token);
    ensure(users.response.ok && Array.isArray(users.body.items));
    assertProfileVisibility(users.body.items.find(row => row.id === auth.body.user.id), auth.body.user, profile.body[0], index === 0);
  }
  const privateProfile = await request(`${config.url}/rest/v1/waylo_profiles?select=user_id&user_id=eq.${encodeURIComponent(admin.body.user.id)}`, { headers: { apikey: config.key, Authorization: `Bearer ${normal.body.access_token}` } });
  ensure(privateProfile.response.ok && Array.isArray(privateProfile.body) && privateProfile.body.length === 0);
  pass('Real canonical names, cities, confirmation and role status match admin search; profiles remain private');
  step = 'live read functions';
  for (const name of ['waylo_admin_overview', 'waylo_admin_users', 'waylo_admin_trips']) {
    const result = await supabase(`/rest/v1/rpc/${name}`, {}, admin.body.access_token); ensure(result.response.ok);
    if (name === 'waylo_admin_trips' && result.body.items?.length) {
      const trip = await supabase('/rest/v1/rpc/waylo_admin_trip', { room: result.body.items[0].id }, admin.body.access_token); ensure(trip.response.ok && trip.body.document);
    }
  }
  pass('Real statistics, user/trip pages and available trip detail load');
  step = 'web server login';
  const login = await request(`${config.origin}/api/login`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_TEST_EMAIL, password: env.ADMIN_TEST_PASSWORD }) });
  ensure(login.response.ok && login.body.csrf); cookie = login.response.headers.get('set-cookie')?.split(';')[0]; csrf = login.body.csrf; ensure(cookie);
  ensure(login.body.user.id === admin.body.user.id && !login.body.access_token && !login.body.refresh_token);
  ensure(/HttpOnly/i.test(login.response.headers.get('set-cookie')) && /SameSite=Strict/i.test(login.response.headers.get('set-cookie')));
  for (const path of ['/api/overview', '/api/users', '/api/trips']) ensure((await request(config.origin + path, { headers: { Cookie: cookie } })).response.ok);
  for (const [index, auth] of [admin, normal].entries()) {
    const page = await request(`${config.origin}/api/users?q=${encodeURIComponent(auth.body.user.email)}`, { headers: { Cookie: cookie } });
    ensure(page.response.ok && Array.isArray(page.body.items));
    assertProfileVisibility(page.body.items.find(row => row.id === auth.body.user.id), auth.body.user, profiles[index], index === 0);
  }
  const denied = await request(`${config.origin}/api/login`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_NORMAL_TEST_EMAIL, password: env.ADMIN_NORMAL_TEST_PASSWORD }) }); ensure(denied.response.status === 403);
  pass('Server login grants admin access and denies a normal account');
  step = 'web logout';
  const logout = await request(`${config.origin}/api/logout`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-Waylo-CSRF': csrf }, body: '{}' }); ensure(logout.response.ok);
  ensure((await request(`${config.origin}/api/overview`, { headers: { Cookie: cookie } })).response.status === 401); cookie = null;
  pass('Signed-out server session cannot read admin data');
  report.status = 'PASSED'; report.authenticatedLive = 'passed';
} catch { report.status = 'FAILED'; report.authenticatedLive = 'failed'; report.checks.push({ name: step, status: 'failed' }); error(`FAIL: ${step}. Check the project settings, admin migration/grants and running web server. No secrets or data bodies were printed.`); exitCode = 1; }
finally {
  if (cookie) await request(`${config.origin}/api/logout`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-Waylo-CSRF': csrf }, body: '{}' }).catch(() => {});
  for (const auth of [admin, normal]) if (auth?.body.access_token) await supabase('/auth/v1/logout?scope=local', {}, auth.body.access_token).catch(() => {});
}
}
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await runAdminVerification({ authenticated: process.argv.includes('--authenticated') });
  process.exitCode = result.exitCode;
}
