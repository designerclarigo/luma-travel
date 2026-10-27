import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { httpsUrl, publicSupabaseKey } from '../backend/config.mjs';

export function loadEnvironment() {
  const root = new URL('../', import.meta.url);
  const file = (path) => existsSync(new URL(path, root)) ? parseEnv(readFileSync(new URL(path, root), 'utf8')) : {};
  return { ...file('.env.local'), ...file('admin/.env.local'), ...process.env };
}
export function adminConfig(env) {
  const url = httpsUrl(env.ADMIN_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL, { root: true });
  const key = (env.ADMIN_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const port = Number(env.ADMIN_PORT || 8788);
  const origin = env.ADMIN_ORIGIN || `http://127.0.0.1:${port}`;
  const issues = [];
  if (!url) issues.push('ADMIN_SUPABASE_URL');
  if (!publicSupabaseKey(key)) issues.push('ADMIN_SUPABASE_PUBLISHABLE_KEY (public publishable or legacy anon key)');
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push('ADMIN_PORT');
  let secure = false; let host; let loopback = false;
  try {
    const parsed = new URL(origin); host = parsed.host; secure = parsed.protocol === 'https:'; loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
    if (parsed.origin !== origin || !(secure || parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname))) issues.push('ADMIN_ORIGIN (HTTPS required outside loopback)');
  } catch { issues.push('ADMIN_ORIGIN'); }
  const demoEnabled = env.ADMIN_DEMO_DATA === '1';
  if (demoEnabled && (env.NODE_ENV === 'production' || !loopback || !['127.0.0.1', 'localhost', '::1'].includes(env.ADMIN_HOST || '127.0.0.1'))) issues.push('ADMIN_DEMO_DATA (development loopback only)');
  const inviteKey = (env.ADMIN_SUPABASE_SECRET_KEY || env.ADMIN_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const inviteIssues = [];
  let privileged = /^sb_secret_[A-Za-z0-9_-]{20,}$/.test(inviteKey);
  if (!privileged && inviteKey.split('.').length === 3) {
    try { const claims = JSON.parse(Buffer.from(inviteKey.split('.')[1], 'base64url').toString('utf8')); privileged = claims.role === 'service_role' && (!claims.ref || url && new URL(url).hostname === `${claims.ref}.supabase.co`); } catch { /* Invalid server key. */ }
  }
  if (!privileged) inviteIssues.push('ADMIN_SUPABASE_SECRET_KEY (server only)');
  const inviteRedirect = env.ADMIN_INVITE_REDIRECT_URL?.trim() || '';
  try {
    const redirect = new URL(inviteRedirect);
    const local = !secure && ['127.0.0.1', 'localhost', '[::1]'].includes(redirect.hostname) && redirect.protocol === 'http:';
    const native = redirect.protocol === 'waylo:' && redirect.hostname === 'auth' && redirect.pathname === '/callback';
    if (redirect.username || redirect.password || redirect.search || redirect.hash || !(native || redirect.pathname === '/auth/callback' && (redirect.protocol === 'https:' || local))) throw Error();
  } catch { inviteIssues.push('ADMIN_INVITE_REDIRECT_URL (approved app callback)'); }
  return { url, key, inviteKey, inviteRedirect, inviteIssues, invitationsConfigured: inviteIssues.length === 0, demoEnabled, port, origin, host, secure, bind: env.ADMIN_HOST || '127.0.0.1', issues, configured: !issues.length };
}
