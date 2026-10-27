import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { adminConfig, loadEnvironment } from './config.mjs';
import { loadDemoStore, seedDemo } from './demo-data.mjs';

const COOKIE = 'waylo_admin';
const token = () => randomBytes(32).toString('hex');
const uuid = (value) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/model.mjs', ['model.mjs', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/fonts/editorial.ttf', ['../../assets/fonts/CormorantGaramond-Medium.ttf', 'font/ttf']],
  ['/fonts/sans.ttf', ['../../assets/fonts/DMSans-Regular.ttf', 'font/ttf']],
  ['/fonts/medium.ttf', ['../../assets/fonts/DMSans-Medium.ttf', 'font/ttf']],
]);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let length = 0; const chunks = [];
    const done = () => { clearTimeout(timer); req.off('data', data); req.off('end', end); req.off('error', fail); };
    const fail = (error) => { done(); req.resume(); reject(error); };
    const data = (chunk) => { length += chunk.length; if (length > 32000) fail(new HttpError(413, 'Request too large.')); else chunks.push(chunk); };
    const end = () => { done(); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Send valid JSON.')); } };
    const timer = setTimeout(() => fail(new HttpError(408, 'Request timed out.')), 15000);
    req.on('data', data); req.once('end', end); req.once('error', fail);
  });
}
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookieId = (req) => req.headers.cookie?.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);

export function createAdminServer({ env = loadEnvironment(), fetcher = globalThis.fetch, now = Date.now, demoStore } = {}) {
  const config = adminConfig(env);
  const demo = config.demoEnabled && config.configured ? demoStore ? Promise.resolve(demoStore) : loadDemoStore({ clock: now }).catch(() => null) : Promise.resolve(null);
  const sessions = new Map(); const attempts = new Map();
  const cookie = (id, age = 28800) => `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${config.secure ? '; Secure' : ''}`;
  async function upstream(path, { method = 'POST', body, access, signal } = {}) {
    let response;
    try {
      response = await fetcher(`${config.url}${path}`, {
        method, headers: { apikey: config.key, ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
      });
    } catch { throw new HttpError(503, 'Supabase could not be reached. Check the connection and try again.'); }
    let data;
    try { data = await response.json(); } catch { throw new HttpError(502, 'Supabase returned an unreadable response.'); }
    if (!response.ok) {
      if (data.code === 'PGRST202' || data.code === '42P01') throw new HttpError(503, 'Admin database setup is missing. Apply backend/supabase.sql, backend/admin.sql, backend/auth-profiles.sql and backend/user-management.sql in order.');
      if (data.code === '42501' || response.status === 403) throw new HttpError(403, 'This account has no active administrator grant. Ask the project owner to grant access in Supabase.');
      if (data.code === '40001') throw new HttpError(409, path.includes('edit_profile') ? 'This profile changed. Close it, refresh users and review the latest details.' : 'This trip changed since you opened it. Refresh and review the latest revision before deleting.');
      if (data.code === '23505') throw new HttpError(409, 'This account is already registered. Search users before inviting again.');
      if (data.code === 'P0001' && data.message === 'invite_rate_limit') throw new HttpError(429, 'Please wait before sending another invitation.');
      if (data.code === 'P0002') throw new HttpError(404, path.includes('profile') ? 'This account profile no longer exists.' : 'This shared trip no longer exists.');
      if (response.status === 401 || path.startsWith('/auth/') && response.status === 400) throw new HttpError(401, 'Sign-in failed or expired. Check your credentials and email confirmation.');
      if (response.status === 429) throw new HttpError(429, 'Too many requests. Please wait and try again.');
      if (data.code === '22023') throw new HttpError(400, 'Check the request fields and confirmation.');
      throw new HttpError(502, 'The database request could not finish. Please retry.');
    }
    return data;
  }
  const rpc = (name, body, session, signal) => upstream(`/rest/v1/rpc/${name}`, { body, access: session.access, signal });
  async function inviteUser(email, name, signal) {
    let response;
    try { response = await fetcher(`${config.url}/auth/v1/invite?redirect_to=${encodeURIComponent(config.inviteRedirect)}`, {
      method: 'POST', headers: { apikey: config.inviteKey, Authorization: `Bearer ${config.inviteKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, data: { full_name: name } }), signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    }); } catch { throw new HttpError(503, 'The invitation request could not be confirmed. Refresh users before retrying; it may have reached the email service.'); }
    let data; try { data = await response.json(); } catch { throw new HttpError(502, 'The invitation response could not be confirmed. Refresh users before retrying.'); }
    if (!response.ok) {
      if (response.status === 429) throw new HttpError(429, 'Supabase email sending is rate limited. Try later or configure the project email service.');
      if (['email_exists', 'user_already_exists'].includes(data.code)) throw new HttpError(409, 'This account is already registered. Search users instead.');
      if ([401,403].includes(response.status)) throw new HttpError(503, 'The server invitation key was rejected. Check the server-only Supabase secret for this project.');
      throw new HttpError(502, 'Supabase could not accept the invitation. Check the project email configuration and refresh users before retrying.');
    }
    const user = data?.user ?? data;
    if (!user || !uuid(user.id) || user.email?.toLowerCase() !== email) throw new HttpError(502, 'The invited account could not be confirmed. Refresh users before retrying.');
    return { id: user.id, email, name };
  }
  async function authorized(req, res, signal) {
    const id = cookieId(req); const session = id && sessions.get(id);
    if (!session || now() >= session.expires || now() - session.touched >= 1800000) {
      if (id) sessions.delete(id); res.setHeader('Set-Cookie', cookie('', 0)); throw new HttpError(401, 'Sign in with your administrator account.');
    }
    if (session.tokenExpires <= now() + 30000) {
      if (!session.refreshing) session.refreshing = upstream('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh }, signal }).then((next) => {
        if (!next.access_token || !next.refresh_token) throw new HttpError(401, 'Sign in again.');
        session.access = next.access_token; session.refresh = next.refresh_token;
        session.tokenExpires = now() + Math.min(Number(next.expires_in) || 3600, 86400) * 1000;
      }).finally(() => { session.refreshing = null; });
      await session.refreshing;
    }
    // Server-verified identity and a fresh DATABASE role check on every request.
    const user = await upstream('/auth/v1/user', { method: 'GET', access: session.access, signal });
    if (user.id !== session.user.id) throw new HttpError(401, 'Sign in again.');
    const status = await rpc('waylo_admin_status', {}, session, signal);
    if (status?.admin !== true || status.schema !== 1) throw new HttpError(503, 'The admin database schema needs updating.');
    session.touched = now(); return session;
  }
  const server = http.createServer(async (req, res) => {
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    };
    if (config.secure) headers['Strict-Transport-Security'] = 'max-age=31536000';
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    const send = (status, body) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); } };
    try {
      if (config.host && req.headers.host !== config.host) throw new HttpError(403, 'Use the configured admin origin.');
      const url = new URL(req.url, config.origin);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        const content = await readFile(new URL(file, new URL('./public/', import.meta.url)));
        res.writeHead(200, { 'Content-Type': type }); res.end(content); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/config') {
        send(200, { configured: config.configured, missing: config.issues, demoAvailable: !!(await demo), invitations: { configured: config.invitationsConfigured, missing: config.inviteIssues }, database: 'Verified after administrator sign-in', service: 'waylo-admin' }); return;
      }
      if (req.method === 'GET' && url.pathname === '/health') { send(200, { service: 'waylo-admin', status: 'ok' }); return; }
      if (req.method === 'GET' && url.pathname === '/ready') { send(config.configured ? 200 : 503, { configured: config.configured, databaseVerified: false }); return; }
      if (!url.pathname.startsWith('/api/')) throw new HttpError(404, 'Not found.');
      if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
      if (req.method === 'POST' && (req.headers.origin !== config.origin || !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? ''))) throw new HttpError(403, 'Use the dashboard on its configured origin.');
      if (!config.configured) throw new HttpError(503, 'Supabase is not configured. Add the project URL and public key in admin/.env.local, then restart this server.');
      for (const [id, session] of sessions) if (now() >= session.expires || now() - session.touched >= 1800000) sessions.delete(id);
      if (url.pathname === '/api/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        for (const [key, attempt] of attempts) if (now() - attempt.start >= 600000) attempts.delete(key);
        const attempt = attempts.get(ip) ?? { start: now(), count: 0 };
        if (attempt.count >= 10 || attempts.size > 1000) throw new HttpError(429, 'Too many sign-in attempts. Wait ten minutes and try again.');
        attempt.count++; attempts.set(ip, attempt);
        const body = await readJson(req);
        if (!body || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.length > 320 || typeof body.password !== 'string' || !body.password || body.password.length > 512) throw new HttpError(400, 'Enter your email and password.');
        const auth = await upstream('/auth/v1/token?grant_type=password', { body: { email: body.email.trim(), password: body.password }, signal: controller.signal });
        if (!auth.access_token || !auth.refresh_token || !auth.user?.id) throw new HttpError(401, 'Sign in again.');
        const session = { access: auth.access_token, refresh: auth.refresh_token, tokenExpires: now() + Math.min(Number(auth.expires_in) || 3600, 86400) * 1000,
          user: { id: auth.user.id, email: auth.user.email }, csrf: token(), expires: now() + 28800000, touched: now() };
        try {
          const verified = await upstream('/auth/v1/user', { method: 'GET', access: session.access, signal: controller.signal });
          if (verified.id !== session.user.id) throw new HttpError(401, 'Sign in again.');
          const status = await rpc('waylo_admin_status', {}, session, controller.signal);
          if (status?.admin !== true || status.schema !== 1) throw new HttpError(503, 'The admin database schema needs updating.');
        } catch (error) {
          await upstream('/auth/v1/logout?scope=local', { access: session.access }).catch(() => {}); throw error;
        }
        if (sessions.size >= 500) throw new HttpError(503, 'This server is at session capacity. Try later.');
        const id = token(); sessions.set(id, session); res.setHeader('Set-Cookie', cookie(id));
        send(200, { user: session.user, csrf: session.csrf }); return;
      }
      if (url.pathname === '/api/session' && req.method === 'GET' && !cookieId(req)) { send(200, { user: null }); return; }
      const session = await authorized(req, res, controller.signal);
      if (req.method === 'POST' && !same(req.headers['x-waylo-csrf'], session.csrf)) throw new HttpError(403, 'Refresh the page before trying this action again.');
      if (url.pathname === '/api/session' && req.method === 'GET') { send(200, { user: session.user, csrf: session.csrf }); return; }
      if (url.pathname === '/api/logout' && req.method === 'POST') {
        sessions.delete(cookieId(req)); res.setHeader('Set-Cookie', cookie('', 0));
        await upstream('/auth/v1/logout?scope=local', { access: session.access }).catch(() => {}); send(200, { signedOut: true }); return;
      }
      // Always authenticate and re-check the REAL database administrator grant first.
      // Demo records are never merged with real records and never call cloud mutations.
      const source = req.headers['x-waylo-data-source'] || 'live';
      if (!['live', 'demo'].includes(source)) throw new HttpError(400, 'Choose a valid data source.');
      const store = source === 'demo' ? await demo : null;
      if (source === 'demo' && !store) throw new HttpError(403, 'Demo data is disabled. Seed and explicitly enable it on a development loopback server.');
      const dataRpc = async (name, args) => {
        if (!store) return rpc(name, args, session, controller.signal);
        try { return await store.rpc(name, args); } catch (error) { throw new HttpError(error.status || 503, error.status ? error.message : 'Demo data could not be saved. Check local file access.'); }
      };
      if (url.pathname === '/api/overview' && req.method === 'GET') { send(200, await dataRpc('waylo_admin_overview', {})); return; }
      if (url.pathname === '/api/users/invite' && req.method === 'POST') {
        const body = await readJson(req);
        if (!body || Object.keys(body).some((key) => !['email','name'].includes(key)) || typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(body.email.trim()) || typeof body.name !== 'string' || body.name.length > 100 || body.name.trim().length === 1 || /[\x00-\x1f\x7f]/.test(body.name)) throw new HttpError(400, 'Enter a valid email and an optional name of 2–100 characters.');
        const email = body.email.trim().toLowerCase(), name = body.name.trim();
        if (store) { try { send(201, await store.invite(email, name)); } catch (error) { throw new HttpError(error.status || 503, error.status ? error.message : 'Demo data could not be saved.'); } return; }
        if (!config.invitationsConfigured) throw new HttpError(503, `Invitations require server configuration: ${config.inviteIssues.join(', ')}. Existing users and cloud data remain connected.`);
        const request = await rpc('waylo_admin_prepare_user_invite', { invitee_email: email, invitee_name: name }, session, controller.signal);
        if (!uuid(request?.request_id)) throw new HttpError(502, 'The database could not record this invitation request. No invitation was sent.');
        let invited;
        try { invited = await inviteUser(email, name, controller.signal); }
        catch (error) { await rpc('waylo_admin_finish_user_invite', { request_id: request.request_id, outcome: error.status === 503 || error.status === 502 ? 'unknown' : 'failed', invited_user_id: null }, session).catch(() => {}); throw error; }
        try { await rpc('waylo_admin_finish_user_invite', { request_id: request.request_id, outcome: 'accepted', invited_user_id: invited.id }, session, controller.signal); }
        catch { throw new HttpError(503, 'Supabase accepted the invitation, but its final audit update failed. Refresh users before trying again.'); }
        send(201, { user: invited, invitationRequested: true, deliveryVerified: false }); return;
      }
      const profileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/profile$/);
      if (profileMatch && uuid(profileMatch[1]) && req.method === 'POST') {
        const body = await readJson(req);
        if (!body || Object.keys(body).some((key) => !['name','city','updatedAt'].includes(key)) || typeof body.name !== 'string' || typeof body.city !== 'string' || body.name.length > 100 || body.city.length > 100 || body.name.trim().length === 1 || /[\x00-\x1f\x7f]/.test(body.name + body.city) || typeof body.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt))) throw new HttpError(400, 'Check the profile name, home city and current profile version.');
        send(200, await dataRpc('waylo_admin_edit_profile', { target_user: profileMatch[1], profile_name: body.name.trim(), profile_city: body.city.trim(), expected_updated_at: body.updatedAt })); return;
      }
      if (['/api/users', '/api/trips'].includes(url.pathname) && req.method === 'GET') {
        const page = Number(url.searchParams.get('page') ?? '1'); const search = (url.searchParams.get('q') ?? '').trim(); const status = url.searchParams.get('status') ?? 'all';
        if (!Number.isInteger(page) || page < 1 || page > 100000 || search.length > 100 || !['all', 'upcoming', 'ongoing', 'past', 'completed', 'unscheduled'].includes(status)) throw new HttpError(400, 'Invalid search or page.');
        const users = url.pathname === '/api/users';
        send(200, await dataRpc(users ? 'waylo_admin_users' : 'waylo_admin_trips', { page_number: page, search_text: search, ...(!users ? { status_filter: status } : {}) })); return;
      }
      const match = url.pathname.match(/^\/api\/trips\/([^/]+)(\/delete)?$/);
      if (match && uuid(match[1])) {
        if (!match[2] && req.method === 'GET') { send(200, await dataRpc('waylo_admin_trip', { room: match[1] })); return; }
        if (match[2] && req.method === 'POST') {
          const body = await readJson(req);
          if (body?.confirmation !== 'DELETE' || typeof body.reason !== 'string' || body.reason.trim().length < 6 || body.reason.length > 500 || !Number.isInteger(body.revision) || body.revision < 1) throw new HttpError(400, 'Type DELETE and provide a reason of 6–500 characters.');
          send(200, await dataRpc('waylo_admin_delete_trip', { room: match[1], expected_revision: body.revision, confirmation: body.confirmation, reason: body.reason.trim() })); return;
        }
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) {
      if (error instanceof HttpError && [401, 403].includes(error.status) && cookieId(req)) { sessions.delete(cookieId(req)); res.setHeader('Set-Cookie', cookie('', 0)); }
      send(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'The request could not finish. Please retry.' });
    } finally { res.off('close', cancel); }
  });
  server.requestTimeout = 20000; server.headersTimeout = 10000;
  return { server, config };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnvironment();
  if (process.argv.includes('--demo')) env.ADMIN_DEMO_DATA = '1';
  const previewConfig = adminConfig(env);
  if (previewConfig.demoEnabled && previewConfig.configured) await seedDemo();
  const { server, config } = createAdminServer({ env });
  if (config.issues.some((i) => i.startsWith('ADMIN_PORT') || i.startsWith('ADMIN_ORIGIN') || i.startsWith('ADMIN_DEMO_DATA'))) { console.error('Fix ADMIN_PORT / ADMIN_ORIGIN / ADMIN_DEMO_DATA in admin/.env.local. Demo data is development-loopback only.'); process.exitCode = 1; }
  else {
    server.on('error', (error) => { console.error(`Admin server could not start (${error.code ?? 'unknown'}).`); process.exitCode = 1; });
    server.listen(config.port, config.bind, () => {
      console.log(`Waylo admin: ${config.origin}`);
      console.log(config.configured ? 'Supabase configured. Admin membership and migrations are verified only after sign-in.' : `Setup required: ${config.issues.join(', ')}. No live data is shown.`);
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
  }
}
