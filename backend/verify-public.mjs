// Real, unauthenticated, read-only checks. No token grant, SQL execution or AI request.
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { adminConfig, loadEnvironment } from '../admin/config.mjs';
import { readConfig } from './config.mjs';
import { assertPermissionDenied, verificationReport, saveVerificationReport } from './verification.mjs';

export async function runPublicVerification({ env, serverEnv, fetcher = fetch, root = new URL('../', import.meta.url), log = console.log } = {}) {
  const report = { ...verificationReport(), scope: 'Public/anonymous read-only checks; no authenticated live checks or migrations', local: {}, failures: [] };
  const path = new URL('docs/verification/public-security-current.json', root);
  saveVerificationReport(path, report);
  const ensure = (condition) => { if (!condition) throw new Error('Verification assertion failed'); };
  const request = async (url, init = {}) => {
    const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(12000) });
    const text = await response.text();
    let body; try { body = JSON.parse(text); } catch { /* HTML/assets are checked without printing contents. */ }
    return { response, text, body };
  };
  const check = async (name, action) => {
    try { await action(); report.checks.push({ name, status: 'passed' }); log(`PASS: ${name}`); }
    catch { report.checks.push({ name, status: 'failed' }); report.failures.push(name); log(`FAIL: ${name}. No response bodies were logged.`); }
  };
  try {
    env ??= loadEnvironment();
    const admin = adminConfig(env);
    if (!admin.configured) report.blocked.push('Admin public configuration is incomplete');
    else {
      await check('Admin public assets, health/readiness and security headers', async () => {
        for (const asset of ['/', '/app.js', '/model.mjs', '/style.css']) {
          const result = await request(admin.origin + asset); ensure(result.response.status === 200 && result.text.length > 0);
          ensure(result.response.headers.get('x-content-type-options') === 'nosniff');
          ensure(result.response.headers.get('cache-control')?.includes('no-store'));
          ensure(result.response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
        }
        const health = await request(admin.origin + '/health'); ensure(health.response.status === 200 && health.body.service === 'waylo-admin');
        const ready = await request(admin.origin + '/ready'); ensure(ready.response.status === 200 && ready.body.databaseVerified === false);
        report.local.admin = { health: health.response.status, ready: ready.response.status, databaseVerified: false };
      });
      await check('Anonymous, forged-session and demo-header requests cannot read admin data', async () => {
        const session = await request(admin.origin + '/api/session'); ensure(session.body.user === null && !session.body.csrf);
        for (const route of ['/api/overview', '/api/users', '/api/trips', '/api/trips/00000000-0000-0000-0000-000000000000']) {
          for (const headers of [{}, { 'X-Waylo-Data-Source': 'demo' }, { Authorization: 'Bearer local-demo-v1', 'X-Waylo-Role': 'admin' }, { Cookie: `waylo_admin=${'0'.repeat(64)}` }]) {
            const denied = await request(admin.origin + route, { headers }); ensure(denied.response.status === 401 && !denied.body?.items && !denied.body?.document);
          }
        }
      });
      await check('Private files and server modules are outside the public asset allowlist', async () => {
        for (const asset of ['/.env.local', '/.env.test.local', '/.demo/users.json', '/config.mjs', '/verification.mjs']) ensure((await request(admin.origin + asset)).response.status === 404);
      });
      await check('Cross-origin admin POST is rejected before any mutation', async () => {
        const result = await request(admin.origin + '/api/logout', { method: 'POST', headers: { Origin: 'https://untrusted.example.test', 'Content-Type': 'application/json' }, body: '{}' });
        ensure(result.response.status === 403);
      });
      await check('Real Supabase public Auth settings are reachable', async () => {
        const result = await request(admin.url + '/auth/v1/settings', { headers: { apikey: admin.key } });
        ensure(result.response.status === 200 && typeof result.body.external === 'object');
        report.auth = { emailEnabled: result.body.external.email === true, signupDisabled: result.body.disable_signup === true, emailAutoConfirm: result.body.mailer_autoconfirm === true };
      });
      await check('Anonymous Supabase table reads receive actual PostgreSQL permission denial', async () => {
        for (const [table, column] of [['waylo_rooms', 'id'], ['waylo_members', 'user_id'], ['waylo_invites', 'room_id'], ['waylo_backups', 'user_id'], ['waylo_profiles', 'user_id'], ['waylo_admins', 'user_id'], ['waylo_admin_audit', 'id']]) {
          const result = await request(`${admin.url}/rest/v1/${table}?select=${column}&limit=1`, { headers: { apikey: admin.key } });
          assertPermissionDenied(result.response.status, result.body);
        }
      });
      await check('Anonymous Supabase read RPCs receive actual PostgreSQL permission denial', async () => {
        for (const [name, args] of [['waylo_status', {}], ['waylo_admin_status', {}], ['waylo_admin_overview', {}], ['waylo_admin_users', {}], ['waylo_admin_trips', {}], ['waylo_admin_trip', { room: '00000000-0000-0000-0000-000000000000' }]]) {
          const result = await request(`${admin.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: admin.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
          assertPermissionDenied(result.response.status, result.body);
        }
      });
    }
    const serverFile = new URL('backend/.env.local', root);
    const server = readConfig(serverEnv ?? { ...(existsSync(serverFile) ? parseEnv(readFileSync(serverFile, 'utf8')) : {}), ...process.env });
    if (server.host !== '127.0.0.1' || !server.port) report.blocked.push('Assistant local loopback bind is unavailable for safe checks');
    else await check('Local assistant health and honest configuration readiness', async () => {
      const origin = `http://127.0.0.1:${server.port}`;
      const health = await request(origin + '/health'); ensure(health.response.status === 200 && health.body.service === 'waylo-assistant');
      const ready = await request(origin + '/ready'); ensure(ready.response.status === (server.ready ? 200 : 503) && ready.body.configured === server.ready);
      report.local.assistant = { health: health.response.status, ready: ready.response.status, configured: ready.body.configured, liveAI: 'not tested' };
    });
    report.status = report.failures.length ? 'FAILED' : report.blocked.length ? 'BLOCKED' : 'PASSED';
  } catch {
    report.status = 'FAILED'; report.failures.push('Public verification setup'); log('FAIL: public verification setup. No secrets or provider bodies were logged.');
  } finally { saveVerificationReport(path, report); }
  return { report, exitCode: report.status === 'PASSED' ? 0 : report.status === 'BLOCKED' ? 2 : 1 };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exitCode = (await runPublicVerification()).exitCode;
