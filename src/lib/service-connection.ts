/** Public configuration only. Never put OpenAI or Supabase secret keys in Expo. */
export function projectUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'
      ? url.origin : null;
  } catch { return null; }
}

export function isPublicSupabaseKey(value: string | undefined): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value ?? '')) return true;
  try {
    const payload = value!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role === 'anon';
  } catch { return false; }
}

export function assistantUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/packing-chat')) return null;
    // localhost on a phone points to that phone, not your development computer.
    if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export async function checkAssistantConnection(endpoint: string, signal?: AbortSignal): Promise<string> {
  const url = assistantUrl(endpoint);
  if (!url) throw new Error('Configure a phone-reachable HTTPS URL ending in /packing-chat.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 10000);
  try {
    const response = await fetch(url.replace(/\/packing-chat$/, '/ready'), { signal: controller.signal });
    const body = await response.json();
    if (body?.service !== 'waylo-assistant' || body.version !== 1) throw new Error('This URL does not point to the Waylo assistant server.');
    if (!response.ok || body.configured !== true) throw new Error('The backend is reachable, but its AI/auth configuration is incomplete.');
    return 'Backend reachable and configured. Sign in to test a real AI request; this check does not contact OpenAI.';
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Connection check cancelled or timed out. Check the backend HTTPS address.');
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('Could not reach the Waylo backend. Check its HTTPS URL, network and web-origin settings. Metro exposes only the app bundle.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
