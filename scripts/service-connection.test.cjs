const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-support.cjs');
const { assistantUrl, isPublicSupabaseKey, projectUrl, checkAssistantConnection } = load('src/lib/service-connection.ts');
test('service config: only a public HTTPS project origin and unprivileged keys are accepted', () => {
  assert.equal(projectUrl('https://project.supabase.co/'), 'https://project.supabase.co');
  for (const url of ['', 'http://project.supabase.co', 'https://user:secret@project.supabase.co', 'https://project.supabase.co/path', 'https://project.supabase.co?secret=x']) assert.equal(projectUrl(url), null);
  assert.equal(isPublicSupabaseKey('sb_publishable_test_key'), true);
  const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.sig`;
  assert.equal(isPublicSupabaseKey(jwt('anon')), true);
  for (const key of ['sb_secret_test', jwt('service_role'), '', undefined]) assert.equal(isPublicSupabaseKey(key), false);
});
test('service config: phone assistant URLs reject loopback, HTTP, credentials and incorrect paths', () => {
  assert.equal(assistantUrl('https://api.waylo.example/packing-chat'), 'https://api.waylo.example/packing-chat');
  assert.equal(assistantUrl('https://api.waylo.example/api/packing-chat'), 'https://api.waylo.example/api/packing-chat');
  for (const url of ['http://192.168.1.2:8787/packing-chat', 'https://localhost/packing-chat', 'https://127.0.0.1/packing-chat', 'https://[::1]/packing-chat', 'https://api.example/', 'https://api.example/packing-chat?key=secret', 'https://user:secret@api.example/packing-chat']) assert.equal(assistantUrl(url), null);
});
test('service check: readiness is distinct from live AI success and never sends trip or auth data', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async (url, init) => { assert.equal(url, 'https://api.example/ready'); assert.equal(init.body, undefined); assert.equal(init.headers, undefined); return Response.json({ service: 'waylo-assistant', version: 1, configured: true }); };
  assert.match(await checkAssistantConnection('https://api.example/packing-chat'), /does not contact OpenAI/);
});
test('service check: unavailable, wrong-host, network and cancelled states are actionable', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async () => Response.json({ service: 'waylo-assistant', version: 1, configured: false }, { status: 503 });
  await assert.rejects(checkAssistantConnection('https://api.example/packing-chat'), /configuration is incomplete/);
  global.fetch = async () => Response.json({ service: 'other' });
  await assert.rejects(checkAssistantConnection('https://api.example/packing-chat'), /does not point/);
  global.fetch = async () => { throw new TypeError('Network request failed'); };
  await assert.rejects(checkAssistantConnection('https://api.example/packing-chat'), /Metro/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(checkAssistantConnection('https://api.example/packing-chat', controller.signal), /cancelled/);
});
