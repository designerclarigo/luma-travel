import { existsSync, writeFileSync } from 'node:fs';
import { readConfig, httpsUrl, publicSupabaseKey } from './config.mjs';

const root = new URL('../', import.meta.url);
for (const path of ['.env.local', 'backend/.env.local']) if (existsSync(new URL(path, root))) process.loadEnvFile(new URL(path, root));
const config = readConfig();
const appUrl = httpsUrl(process.env.EXPO_PUBLIC_SUPABASE_URL, { root: true });
const appKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const endpoint = httpsUrl(process.env.EXPO_PUBLIC_ASSISTANT_URL);
let assistantUrlValid = false;
if (endpoint) {
  const url = new URL(endpoint);
  assistantUrlValid = url.pathname.endsWith('/packing-chat') && !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname);
}
const report = {
  checkedAt: new Date().toISOString(),
  environmentFiles: ['.env.local', 'backend/.env.local'].map((path) => ({ path, exists: existsSync(new URL(path, root)) })),
  server: { configured: config.ready, issues: config.issues },
  app: { supabaseConfigured: !!appUrl && publicSupabaseKey(appKey), assistantUrlValid,
    sameSupabaseProject: !!appUrl && appUrl === config.supabaseUrl,
    samePublicKey: !!appKey && appKey === config.supabaseKey },
  migration: { prepared: existsSync(new URL('supabase/migrations/20261026000100_waylo_backend.sql', root)), applied: 'not verified' },
  network: [],
  liveAuth: 'not tested', liveAI: 'not tested', sharedTripPersistence: 'not tested', physicalPhone: 'not tested',
};
if (process.argv.includes('--network')) {
  for (const [name, url, headers] of [
    ['supabase-auth-service', appUrl && publicSupabaseKey(appKey) ? `${appUrl}/auth/v1/settings` : null, { apikey: appKey }],
    ['assistant-readiness', assistantUrlValid ? endpoint.replace(/\/packing-chat$/, '/ready') : null, {}],
  ]) {
    if (!url) { report.network.push({ name, status: 'blocked: missing valid public configuration' }); continue; }
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      const ok = response.ok && (name !== 'assistant-readiness' || body.service === 'waylo-assistant' && body.configured === true);
      report.network.push({ name, status: ok ? 'reachable' : 'failed', httpStatus: response.status });
    } catch { report.network.push({ name, status: 'network error or timeout' }); }
  }
}
// Never serialize config itself: it contains server-only secrets.
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--report')) writeFileSync(new URL('docs/verification/backend-setup.json', root), `${JSON.stringify(report, null, 2)}\n`);
if (!config.ready || !report.app.supabaseConfigured || !assistantUrlValid || !report.app.sameSupabaseProject || !report.app.samePublicKey || report.network.some((r) => r.status !== 'reachable')) process.exitCode = 2;
