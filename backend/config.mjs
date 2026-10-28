export function httpsUrl(value, { root = false } = {}) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (root && !['', '/'].includes(url.pathname))) return null;
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}

export function publicSupabaseKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value ?? '')) return true;
  try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'anon'; }
  catch { return false; }
}

export function assistantEndpointConfig(value) {
  const invalid = (issue) => ({ valid: false, url: null, issue });
  if (typeof value !== 'string' || !value.trim()) return invalid('EXPO_PUBLIC_ASSISTANT_URL is missing');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return invalid('EXPO_PUBLIC_ASSISTANT_URL requires HTTPS');
    if (url.username || url.password || url.search || url.hash) return invalid('EXPO_PUBLIC_ASSISTANT_URL must not contain credentials, query or fragment');
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname)) return invalid('EXPO_PUBLIC_ASSISTANT_URL must be reachable from the phone, not loopback');
    if (!url.pathname.endsWith('/packing-chat')) return invalid('EXPO_PUBLIC_ASSISTANT_URL must end exactly in /packing-chat');
    return { valid: true, url: url.href, issue: null };
  } catch { return invalid('EXPO_PUBLIC_ASSISTANT_URL is not a valid URL'); }
}

export function readConfig(env = process.env) {
  const issues = [];
  const openaiKey = env.OPENAI_API_KEY?.trim() ?? '';
  const model = env.OPENAI_MODEL?.trim() ?? '';
  const supabaseUrl = httpsUrl(env.SUPABASE_URL, { root: true });
  const supabaseKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
  const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!openaiKey) issues.push('OPENAI_API_KEY is missing');
  if (!model) issues.push('OPENAI_MODEL is missing');
  if (!supabaseUrl) issues.push('SUPABASE_URL must be a project HTTPS origin');
  if (!publicSupabaseKey(supabaseKey)) issues.push('SUPABASE_PUBLISHABLE_KEY (or legacy anon key) is missing/invalid; never use a service-role/secret key');
  if (origins.some((value) => { try { return new URL(value).origin !== value || !/^https?:/.test(value); } catch { return true; } })) issues.push('ALLOWED_ORIGINS must contain exact http(s) origins without paths or wildcards');
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push('PORT is invalid');
  return { ready: !issues.length, issues, openaiKey, model, supabaseUrl, supabaseKey, origins,
    host: env.HOST?.trim() || '127.0.0.1', port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null };
}
