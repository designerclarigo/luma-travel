// Read-only live acceptance. No user creation, grants, trip edits or deletion.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { adminConfig, loadEnvironment } from './config.mjs';
const root = new URL('../', import.meta.url);
const testFile = new URL('admin/.env.test.local', root);
const env = { ...loadEnvironment(), ...(existsSync(testFile) ? parseEnv(readFileSync(testFile, 'utf8')) : {}) };
const config = adminConfig(env);
const names = ['ADMIN_TEST_EMAIL', 'ADMIN_TEST_PASSWORD', 'ADMIN_NORMAL_TEST_EMAIL', 'ADMIN_NORMAL_TEST_PASSWORD'];
const missing = [...config.issues, ...names.filter((n) => !env[n])];
if (missing.length) { console.log(`Live admin verification BLOCKED: ${missing.join(', ')}. No services were called.`); process.exit(2); }
const report = { checkedAt: new Date().toISOString(), checks: [], destructiveActions: 'not performed' };
let step = 'authenticate existing test accounts'; let admin; let normal; let cookie; let csrf;
const ensure = (condition) => { if (!condition) throw new Error('Acceptance assertion failed'); };
const pass = (name) => { report.checks.push({ name, status: 'passed' }); console.log(`PASS: ${name}`); };
const request = async (url, init = {}) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  const body = await response.json(); return { response, body };
};
const supabase = (path, body, access) => request(`${config.url}${path}`, { method: 'POST', headers: { apikey: config.key, 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) }, body: JSON.stringify(body) });
try {
  admin = await supabase('/auth/v1/token?grant_type=password', { email: env.ADMIN_TEST_EMAIL, password: env.ADMIN_TEST_PASSWORD }); ensure(admin.response.ok && admin.body.access_token);
  normal = await supabase('/auth/v1/token?grant_type=password', { email: env.ADMIN_NORMAL_TEST_EMAIL, password: env.ADMIN_NORMAL_TEST_PASSWORD }); ensure(normal.response.ok && normal.body.access_token && normal.body.user.id !== admin.body.user.id);
  step = 'database admin grants';
  const status = await supabase('/rest/v1/rpc/waylo_admin_status', {}, admin.body.access_token); ensure(status.response.ok && status.body.admin === true); pass('Existing admin grant and migration verified');
  for (const access of [null, normal.body.access_token]) {
    for (const name of ['waylo_admin_status', 'waylo_admin_overview', 'waylo_admin_users', 'waylo_admin_trips']) {
      const denied = await supabase(`/rest/v1/rpc/${name}`, {}, access); ensure([401, 403].includes(denied.response.status));
    }
  }
  pass('Anonymous and normal users denied by database RPC permissions');
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
  for (const path of ['/api/overview', '/api/users', '/api/trips']) ensure((await request(config.origin + path, { headers: { Cookie: cookie } })).response.ok);
  const denied = await request(`${config.origin}/api/login`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_NORMAL_TEST_EMAIL, password: env.ADMIN_NORMAL_TEST_PASSWORD }) }); ensure(denied.response.status === 403);
  pass('Server login grants admin access and denies a normal account');
  step = 'web logout';
  const logout = await request(`${config.origin}/api/logout`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-Waylo-CSRF': csrf }, body: '{}' }); ensure(logout.response.ok);
  ensure((await request(`${config.origin}/api/overview`, { headers: { Cookie: cookie } })).response.status === 401); cookie = null;
  pass('Signed-out server session cannot read admin data');
} catch { report.checks.push({ name: step, status: 'failed' }); console.error(`FAIL: ${step}. Check the project settings, admin migration/grants and running web server. No secrets or data bodies were printed.`); process.exitCode = 1; }
finally {
  if (cookie) await request(`${config.origin}/api/logout`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-Waylo-CSRF': csrf }, body: '{}' }).catch(() => {});
  for (const auth of [admin, normal]) if (auth?.body.access_token) await supabase('/auth/v1/logout?scope=local', {}, auth.body.access_token).catch(() => {});
  writeFileSync(new URL('docs/verification/admin-live.json', root), `${JSON.stringify(report, null, 2)}\n`);
}
