const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const http = require('node:http');
const userId = '11111111-1111-4111-8111-111111111111';
const roomId = '22222222-2222-4222-8222-222222222222';
const access = 'test-only-access-token'; const refresh = 'test-only-refresh-token';

async function setup(t, options = {}) {
  const { createAdminServer } = await import('../admin/server.mjs');
  const env = { ADMIN_SUPABASE_URL: 'https://unit-test.supabase.co', ADMIN_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit_test', ADMIN_ORIGIN: 'http://127.0.0.1:8788', ...options.env };
  const calls = []; let granted = true; let clock = 100000;
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (options.fetcher) return options.fetcher(url, init);
    if (options.override) { const response = await options.override(url, init); if (response) return response; }
    if (url.includes('grant_type=')) return Response.json({ access_token: access, refresh_token: refresh, expires_in: 60, user: { id: userId, email: 'admin@example.test' } });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: userId, email: 'admin@example.test' });
    if (url.includes('/logout')) return Response.json({});
    if (url.endsWith('waylo_admin_status')) return granted ? Response.json({ schema: 1, admin: true }) : Response.json({ code: '42501' }, { status: 403 });
    if (url.endsWith('waylo_admin_delete_trip')) return Response.json({ deleted: true });
    if (url.endsWith('waylo_admin_trip')) return Response.json({ summary: { id: roomId, revision: 1 }, document: { schema: 1, trip: {} }, members: [] });
    return Response.json({ items: [], total: 0, page: 1, page_size: 20, users: 0 });
  };
  const { server, config } = createAdminServer({ env, fetcher, now: () => clock, demoStore: options.demoStore });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  // Use raw HTTP so the Host-header security cases are actually transmitted.
  const request = (path, init = {}) => new Promise((resolve, reject) => {
    const req = http.request(base + path, { method: init.method ?? 'GET', headers: { Host: new URL(config.origin).host, ...init.headers } }, (res) => {
      const chunks = []; res.on('data', (chunk) => chunks.push(chunk)); res.on('end', () => {
        const headers = Object.fromEntries(Object.entries(res.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]));
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Test request timed out'))); req.end(init.body);
  });
  const post = (path, body, headers = {}) => request(path, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const login = async () => {
    const response = await post('/api/login', { email: 'admin@example.test', password: 'test-password' });
    assert.equal(response.status, 200); const body = await response.json(); const cookie = response.headers.get('set-cookie').split(';')[0];
    return { cookie, csrf: body.csrf, body, response };
  };
  return { request, post, login, calls, revoke: () => { granted = false; }, advance: (ms) => { clock += ms; } };
}
test('admin demo: real authentication and a fresh database grant remain mandatory', async t => {
  const demoStore = { rpc: async () => ({ demo: true, items: [{ demo: true }] }) };
  const app = await setup(t, { env: { ADMIN_DEMO_DATA: '1' }, demoStore });
  assert.equal((await app.request('/api/users', { headers: { 'X-Waylo-Data-Source': 'demo' } })).status, 401);
  const s = await app.login(); app.revoke();
  assert.equal((await app.request('/api/users', { headers: { Cookie: s.cookie, 'X-Waylo-Data-Source': 'demo' } })).status, 403);
});
test('admin demo: data is explicitly isolated and demo mutations never call Supabase data or mail APIs', async t => {
  const seen = [];
  const demoStore = { rpc: async name => { seen.push(name); return { demo: true, items: [{ demo: true }] }; }, invite: async () => ({ demo: true, simulated: true, invitationRequested: false }) };
  const app = await setup(t, { env: { ADMIN_DEMO_DATA: '1' }, demoStore });
  const s = await app.login(); const headers = { Cookie: s.cookie, 'X-Waylo-CSRF': s.csrf, 'X-Waylo-Data-Source': 'demo' };
  assert.equal((await (await app.request('/api/users', { headers })).json()).demo, true);
  assert.equal((await app.post('/api/users/invite', { name: 'Demo User', email: 'demo@example.test' }, headers)).status, 201);
  assert.equal((await app.post('/api/users/dddddddd-0000-4000-8000-000000000001/profile', { name: 'Demo Name', city: 'Oslo', updatedAt: '2026-10-27T00:00:00Z' }, headers)).status, 200);
  assert.deepEqual(seen, ['waylo_admin_users', 'waylo_admin_edit_profile']);
  assert.equal(app.calls.some(c => /invite|edit_profile|waylo_admin_users/.test(c.url)), false);
  const real = await (await app.request('/api/users', { headers: { Cookie: s.cookie } })).json();
  assert.equal(real.demo, undefined); assert.equal(real.items.length, 0);
});
test('admin demo: production, remote binding and disabled mode cannot expose demo records', async t => {
  const { adminConfig } = await import('../admin/config.mjs');
  for (const env of [{ NODE_ENV: 'production' }, { ADMIN_HOST: '0.0.0.0' }, { ADMIN_ORIGIN: 'https://admin.example.com' }, { ADMIN_ORIGIN: 'invalid' }]) {
    const config = adminConfig({ ADMIN_DEMO_DATA: '1', ...env }); assert.ok(config.issues.some(i => i.startsWith('ADMIN_DEMO_DATA')));
  }
  const app = await setup(t); const s = await app.login();
  assert.equal((await app.request('/api/users', { headers: { Cookie: s.cookie, 'X-Waylo-Data-Source': 'demo' } })).status, 403);
});
test('admin: missing configuration serves the UI but never returns fake records', async (t) => {
  const { request, post, calls } = await setup(t, { env: { ADMIN_SUPABASE_URL: '', ADMIN_SUPABASE_PUBLISHABLE_KEY: '' } });
  const page = await request('/'); assert.equal(page.status, 200); assert.match(await page.text(), /Waylo/);
  assert.equal((await request('/ready')).status, 503);
  const config = await (await request('/api/config')).json(); assert.equal(config.configured, false); assert.equal(config.missing.length, 2);
  assert.equal((await request('/api/overview')).status, 503);
  assert.equal((await post('/api/login', { email: 'test@example.test', password: 'test' })).status, 503); assert.equal(calls.length, 0);
});
test('admin: every data route requires a server session, not a UI flag or forged bearer', async (t) => {
  const { request, post, calls } = await setup(t);
  for (const path of ['/api/overview', '/api/users', '/api/trips', `/api/trips/${roomId}`]) {
    assert.equal((await request(path, { headers: { Authorization: `Bearer ${access}`, Cookie: 'waylo_admin=forged' } })).status, 401);
  }
  assert.equal((await post(`/api/trips/${roomId}/delete`, { confirmation: 'DELETE', revision: 1, reason: 'Test cleanup' })).status, 401);
  assert.deepEqual(await (await request('/api/session')).json(), { user: null }); assert.equal(calls.length, 0);
});
test('admin: login verifies identity and DATABASE grant; tokens never reach browser responses', async (t) => {
  const { login, request, calls } = await setup(t);
  const session = await login(); const serialized = JSON.stringify(session.body) + session.cookie;
  assert.equal(serialized.includes(access), false); assert.equal(serialized.includes(refresh), false); assert.equal(serialized.includes('test-password'), false);
  assert.match(session.response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal(session.body.user.id, userId); assert.equal(session.body.csrf.length, 64);
  assert.ok(calls.some((c) => c.url.endsWith('/auth/v1/user'))); assert.ok(calls.some((c) => c.url.endsWith('waylo_admin_status')));
  const page = await request('/api/overview', { headers: { Cookie: session.cookie } }); assert.equal(page.status, 200);
  assert.equal(calls.at(-1).init.headers.Authorization, `Bearer ${access}`);
});
test('admin: normal users and revoked admin grants cannot access data', async (t) => {
  const app = await setup(t); app.revoke();
  assert.equal((await app.post('/api/login', { email: 'normal@example.test', password: 'test-password' })).status, 403);
  assert.equal(app.calls.some((c) => c.url.endsWith('waylo_admin_overview')), false);
  const granted = await setup(t); const session = await granted.login(); granted.revoke();
  const denied = await granted.request('/api/overview', { headers: { Cookie: session.cookie } });
  assert.equal(denied.status, 403); assert.match(denied.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(granted.calls.some((c) => c.url.endsWith('waylo_admin_overview')), false);
});

test('admin: editable profile metadata cannot grant admin access', async t => {
  const app = await setup(t, { override: async url => url.endsWith('/auth/v1/user') ? Response.json({ id: userId, email: 'normal@example.test', user_metadata: { role: 'admin', is_admin: true, full_name: 'Administrator' } }) : null });
  app.revoke();
  assert.equal((await app.post('/api/login', { email: 'normal@example.test', password: 'test-password' })).status, 403);
  assert.equal(app.calls.some(call => call.url.endsWith('waylo_admin_users')), false);
});

test('admin: user search forwards the query and preserves actual profile and confirmation fields', async t => {
  const row = { id: userId, email: 'ari@example.test', full_name: 'Ari Santos', home_city: 'Lisbon', profile_updated_at: '2026-10-28T10:00:00Z', email_confirmed_at: '2026-10-27T10:00:00Z', is_admin: false };
  const app = await setup(t, { override: async url => url.endsWith('waylo_admin_users') ? Response.json({ items: [row], total: 1, page: 1, page_size: 20 }) : null });
  const session = await app.login();
  const result = await app.request('/api/users?q=Ari%20Santos', { headers: { Cookie: session.cookie } });
  assert.equal(result.status, 200); assert.deepEqual((await result.json()).items, [row]);
  const call = app.calls.findLast(call => call.url.endsWith('waylo_admin_users'));
  assert.deepEqual(JSON.parse(call.init.body), { page_number: 1, search_text: 'Ari Santos' });
});
test('admin: missing migration is distinguishable from a normal account denial', async (t) => {
  const app = await setup(t, { fetcher: async (url) => url.includes('grant_type=') ? Response.json({ access_token: access, refresh_token: refresh, user: { id: userId } }) : url.endsWith('/user') ? Response.json({ id: userId }) : Response.json({ code: 'PGRST202' }, { status: 404 }) });
  const result = await app.post('/api/login', { email: 'admin@example.test', password: 'test-password' });
  assert.equal(result.status, 503); assert.match((await result.json()).error, /backend\/admin.sql/);
});
test('admin: cross-origin requests, host spoofing and CSRF cannot delete a trip', async (t) => {
  const { post, login, request, calls } = await setup(t);
  assert.equal((await post('/api/login', {}, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request('/api/config', { headers: { Host: 'attacker.example' } })).status, 403);
  for (const csrf of ['', 'forged', 'é'.repeat(64)]) {
    const session = await login();
    assert.equal((await post(`/api/trips/${roomId}/delete`, { confirmation: 'DELETE', revision: 1, reason: 'Test cleanup' }, { Cookie: session.cookie, 'X-Waylo-CSRF': csrf })).status, 403);
  }
  assert.equal(calls.some((c) => c.url.endsWith('waylo_admin_delete_trip')), false);
});
test('admin: destructive action requires typed confirmation, reason and current revision', async (t) => {
  const { post, login, calls } = await setup(t); const session = await login();
  const headers = { Cookie: session.cookie, 'X-Waylo-CSRF': session.csrf };
  for (const body of [{}, { confirmation: 'delete', revision: 1, reason: 'Test cleanup' }, { confirmation: 'DELETE', revision: 1, reason: '' }, { confirmation: 'DELETE', revision: 0, reason: 'Test cleanup' }]) assert.equal((await post(`/api/trips/${roomId}/delete`, body, headers)).status, 400);
  assert.equal(calls.some((c) => c.url.endsWith('waylo_admin_delete_trip')), false);
  assert.equal((await post(`/api/trips/${roomId}/delete`, { confirmation: 'DELETE', revision: 3, reason: '  Test cleanup  ' }, headers)).status, 200);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { room: roomId, expected_revision: 3, confirmation: 'DELETE', reason: 'Test cleanup' });
});
test('admin: server rejects invalid filters and paginates only through protected RPCs', async (t) => {
  const { login, request, calls } = await setup(t); const session = await login(); const headers = { Cookie: session.cookie };
  for (const path of ['/api/users?page=0', '/api/users?page=1.5', '/api/trips?status=invalid', '/api/trips?q='+'x'.repeat(101)]) assert.equal((await request(path, { headers })).status, 400);
  assert.equal((await request('/api/users?page=2&q=some%40example.test', { headers })).status, 200);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { page_number: 2, search_text: 'some@example.test' });
});
test('admin: session refresh is single-flight; inactive and signed-out sessions are rejected', async (t) => {
  const { login, request, post, calls, advance } = await setup(t); const session = await login(); const headers = { Cookie: session.cookie };
  advance(40000); await Promise.all([request('/api/overview', { headers }), request('/api/users', { headers })]);
  assert.equal(calls.filter((c) => c.url.includes('grant_type=refresh_token')).length, 1);
  assert.equal((await post('/api/logout', {}, { ...headers, 'X-Waylo-CSRF': session.csrf })).status, 200);
  assert.equal((await request('/api/overview', { headers })).status, 401);
  const second = await login(); advance(1800001);
  assert.equal((await request('/api/overview', { headers: { Cookie: second.cookie } })).status, 401);
});
test('admin: login throttling, malformed/oversized bodies and security headers', async (t) => {
  const { post, request } = await setup(t);
  assert.equal((await post('/api/login', 'x'.repeat(32001))).status, 413);
  assert.equal((await post('/api/login', '{broken')).status, 400);
  for (let n = 0; n < 8; n++) assert.equal((await post('/api/login', {})).status, 400);
  assert.equal((await post('/api/login', {})).status, 429);
  const page = await request('/'); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/.env.local')).status, 404); assert.equal((await request('/server.mjs')).status, 404);
  assert.equal((await request('/fonts/editorial.ttf')).status, 200);
});
test('admin: HTTPS cookies are secure and privileged Supabase keys are not accepted', async (t) => {
  const { adminConfig } = await import('../admin/config.mjs');
  assert.equal(adminConfig({ ADMIN_SUPABASE_URL: 'https://test.supabase.co', ADMIN_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_dont_use' }).configured, false);
  const { login } = await setup(t, { env: { ADMIN_ORIGIN: 'https://admin.waylo.example' } });
  assert.match((await login()).response.headers.get('set-cookie'), /; Secure/);
});
test('admin: UI models escape stored content and preserve quantity-based partial progress', async () => {
  const { escapeHtml, packingProgress, filterPacking, date } = await import('../admin/public/model.mjs');
  assert.equal(escapeHtml('<img src=x onerror="bad()">'), '&lt;img src=x onerror=&quot;bad()&quot;&gt;');
  const items = [{ label: 'Shirts', quantity: 3, packedCount: 1 }, { label: 'Hat', packed: true }, { label: 'Invalid', quantity: -2 }];
  assert.deepEqual(packingProgress(items), { total: 4, packed: 2, percent: 50, invalid: 1 });
  assert.equal(filterPacking(items, 'shirt', 'remaining').length, 1); assert.equal(filterPacking(items, '', 'packed').length, 1); assert.equal(date('bad-date'), 'Not set');
});
test('admin: SQL definitions keep mobile policies unchanged and guard every exposed admin RPC', () => {
  const sql = readFileSync('backend/admin.sql', 'utf8');
  for (const name of ['status', 'overview', 'users', 'trips', 'trip', 'delete_trip']) {
    const definition = sql.split(`function public.waylo_admin_${name}(`)[1].split('$$;')[0];
    assert.match(definition, /security definer set search_path=''/); assert.match(definition, /perform public.waylo_require_admin\(\)/);
  }
  assert.doesNotMatch(sql, /create policy|drop policy/i);
  assert.match(sql, /revoke all on public.waylo_admins, public.waylo_admin_audit from public, anon, authenticated/);
  assert.match(sql, /for update/); assert.match(sql, /insert into public.waylo_admin_audit/);
});

const inviteKey='sb_secret_server_only_unit_test_0123456789';
const inviteEnv={ADMIN_SUPABASE_SECRET_KEY:inviteKey,ADMIN_INVITE_REDIRECT_URL:'http://127.0.0.1:8081/auth/callback'};
const invitedId='33333333-3333-4333-8333-333333333333';
const requestId='44444444-4444-4444-8444-444444444444';
const profilePayload={name:'Ari Santos',city:'Lisbon',updatedAt:'2026-10-27T00:00:00.000Z'};
const inviteOverride=async(url)=>url.endsWith('waylo_admin_prepare_user_invite')?Response.json({request_id:requestId}):url.includes('/auth/v1/invite?')?Response.json({id:invitedId,email:'ari@example.test',password:'must-not-leak'}):null;

test('user management: anonymous and revoked accounts cannot use edits or the privileged invite API',async(t)=>{
 const app=await setup(t,{env:inviteEnv});
 for(const path of ['/api/users/invite','/api/users/'+userId+'/profile']) assert.equal((await app.post(path,{})).status,401);
 const session=await app.login();app.revoke();
 assert.equal((await app.post('/api/users/invite',{email:'ari@example.test',name:'Ari'},{Cookie:session.cookie,'X-Waylo-CSRF':session.csrf})).status,403);
 assert.equal(app.calls.some(c=>c.url.includes('/auth/v1/invite?')),false);
});
test('user management: missing server invite credentials are honest and never use the public key to create users',async(t)=>{
 const app=await setup(t);const s=await app.login();
 const response=await app.post('/api/users/invite',{email:'ari@example.test',name:''},{Cookie:s.cookie,'X-Waylo-CSRF':s.csrf});
 assert.equal(response.status,503);assert.match((await response.json()).error,/ADMIN_SUPABASE_SECRET_KEY/);
 assert.equal(app.calls.some(c=>c.url.includes('/auth/v1/invite?')),false);
});
test('user management: invitations require CSRF and cannot accept role, password or email-confirmation fields',async(t)=>{
 const app=await setup(t,{env:inviteEnv});const s=await app.login();
 assert.equal((await app.post('/api/users/invite',{email:'ari@example.test',name:''},{Cookie:s.cookie})).status,403);
 const second=await app.login();const headers={Cookie:second.cookie,'X-Waylo-CSRF':second.csrf};
 for(const patch of [{role:'admin'},{password:'unsafe'},{email_confirm:true},{redirectTo:'https://attacker.example'}]) assert.equal((await app.post('/api/users/invite',{email:'ari@example.test',name:'',...patch},headers)).status,400);
 assert.equal(app.calls.some(c=>c.url.includes('/auth/v1/invite?')),false);
});
test('user management: database guard/audit precedes the real invitation adapter, secrets never enter responses',async(t)=>{
 const app=await setup(t,{env:inviteEnv,override:inviteOverride});const s=await app.login();
 const response=await app.post('/api/users/invite',{email:'ARI@example.test',name:'Ari'},{Cookie:s.cookie,'X-Waylo-CSRF':s.csrf});
 assert.equal(response.status,201);const data=await response.json();assert.equal(data.deliveryVerified,false);assert.equal(data.user.id,invitedId);
 const serialized=JSON.stringify(data)+JSON.stringify(await(await app.request('/api/config')).json());assert.doesNotMatch(serialized,/server_only_unit_test|must-not-leak/);
 const prep=app.calls.findIndex(c=>c.url.endsWith('waylo_admin_prepare_user_invite'));const send=app.calls.findIndex(c=>c.url.includes('/auth/v1/invite?'));assert.ok(prep>=0&&send>prep);
 assert.equal(app.calls[prep].init.headers.Authorization,'Bearer '+access);assert.equal(app.calls[send].init.headers.apikey,inviteKey);
 assert.deepEqual(JSON.parse(app.calls[send].init.body),{email:'ari@example.test',data:{full_name:'Ari'}});
 assert.ok(app.calls.some(c=>c.url.endsWith('waylo_admin_finish_user_invite')&&JSON.parse(c.init.body).outcome==='accepted'));
});
test('user management: rate limits and unconfirmed invitation outcomes never become success',async(t)=>{
 for(const offline of [false,true]){
 const app=await setup(t,{env:inviteEnv,override:async(url)=>{
  if(url.includes('/auth/v1/invite?')){if(offline)throw Error('private upstream diagnostic');return Response.json({secret:'must-not-leak'},{status:429});}
  return inviteOverride(url);
 }});const s=await app.login();const response=await app.post('/api/users/invite',{email:'ari@example.test',name:''},{Cookie:s.cookie,'X-Waylo-CSRF':s.csrf});
 assert.equal(response.status,offline?503:429);assert.doesNotMatch(JSON.stringify(await response.json()),/must-not-leak|private upstream/);
 const finish=app.calls.find(c=>c.url.endsWith('waylo_admin_finish_user_invite'));assert.equal(JSON.parse(finish.init.body).outcome,offline?'unknown':'failed');
 }
});
test('user management: profile edits forward concurrency version through the user session and reject privilege changes',async(t)=>{
 const app=await setup(t);const s=await app.login();const headers={Cookie:s.cookie,'X-Waylo-CSRF':s.csrf};
 assert.equal((await app.post('/api/users/'+userId+'/profile',{...profilePayload,role:'admin'},headers)).status,400);
 assert.equal((await app.post('/api/users/'+userId+'/profile',profilePayload,headers)).status,200);
 const call=app.calls.find(c=>c.url.endsWith('waylo_admin_edit_profile'));assert.equal(call.init.headers.apikey,'sb_publishable_unit_test');
 assert.deepEqual(JSON.parse(call.init.body),{target_user:userId,profile_name:'Ari Santos',profile_city:'Lisbon',expected_updated_at:profilePayload.updatedAt});
});
test('user management: stale profile and missing migration are explicit failures',async(t)=>{
 for(const code of ['40001','PGRST202']){
 const app=await setup(t,{override:async(url)=>url.endsWith('waylo_admin_edit_profile')?Response.json({code},{status:400}):null});const s=await app.login();
 const r=await app.post('/api/users/'+userId+'/profile',profilePayload,{Cookie:s.cookie,'X-Waylo-CSRF':s.csrf});assert.equal(r.status,code==='40001'?409:503);
 assert.match((await r.json()).error,code==='40001'?/profile changed/:/user-management.sql/);
 }
});
test('user management: additive migration guards every mutation, preserves grants and matches prepared migration',()=>{
 const sql=readFileSync('backend/user-management.sql','utf8');assert.equal((sql.match(/perform public.waylo_require_admin/g)||[]).length,3);
 assert.equal((sql.match(/security definer set search_path=''/g)||[]).length,3);
 assert.doesNotMatch(sql,/insert into auth.users|insert into public.waylo_admins|update public.waylo_admins|email_confirm/);
 assert.equal(sql,readFileSync('supabase/migrations/20261027000200_waylo_user_management.sql','utf8'));
});
