export type Registration = { fullName: string; email: string; password: string; confirmation: string };
export type AuthIssue = { code?: string; message?: string; name?: string };
export const cleanEmail = (email: string) => email.trim().toLowerCase();
export function validEmail(email: string) { return email.length <= 254 && /^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email); }
export function utf8Size(value: string) { let bytes = 0; for (const c of value) { const p = c.codePointAt(0)!; bytes += p < 128 ? 1 : p < 2048 ? 2 : p < 65536 ? 3 : 4; } return bytes; }
export function passwordIssue(password: string, confirmation: string) {
  if (password.length < 8) return 'Use at least 8 characters for your new password.';
  if (utf8Size(password) > 72) return 'Use a shorter password. This service accepts up to 72 UTF-8 bytes.';
  if (password !== confirmation) return 'Your passwords do not match yet.';
  return '';
}
export function registrationIssue(value: Registration) {
  const name = value.fullName.trim();
  if (name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) return 'Add your name using 2–100 characters.';
  if (!validEmail(cleanEmail(value.email))) return 'Enter a valid email address.';
  return passwordIssue(value.password, value.confirmation);
}
export function loginIssue(email: string, password: string) {
  if (!validEmail(cleanEmail(email))) return 'Enter a valid email address.';
  if (!password) return 'Enter your password.';
  return '';
}
export function authMessage(error: unknown) {
  const e = error as AuthIssue | null;
  switch (e?.code) {
    case 'invalid_credentials': return 'That email and password do not match. Try again, or reset your password.';
    case 'email_not_confirmed': return 'Confirm your email before signing in. You can request a fresh link.';
    case 'over_email_send_rate_limit': return 'Too many emails were requested. Please wait before trying again. If your email is already verified, you can use password login instead. The service may require a longer wait than the resend timer.';
    case 'over_request_rate_limit': return 'Too many requests were sent. Please wait and try again later.';
    case 'email_address_not_authorized': case 'email_address_not_allowed': return 'Email delivery is not enabled for this address. Waylo needs its email service configured.';
    case 'otp_expired': case 'flow_state_expired': case 'flow_state_not_found': return 'This email link has expired or was already used. Request a fresh one.';
    case 'weak_password': return 'Choose a stronger password that meets the account service’s requirements.';
    case 'same_password': return 'Choose a different password from your current one.';
    case 'user_already_exists': return 'Try signing in, or use password recovery if you already have an account.';
    case 'signup_disabled': return 'New account registration is currently unavailable. Please try again later.';
    case 'PGRST205': case '42P01': case 'PGRST202': return 'Your account is connected. The new Waylo profile database migration still needs to be installed.';
  }
  if (e?.name === 'TypeError' || e?.name === 'AuthRetryableFetchError' || /network|fetch|timeout/i.test(e?.message ?? '')) return 'We couldn’t reach your account service. Check your connection and try again.';
  if (/email.*not.*authoriz|email.*not.*allow/i.test(e?.message ?? '')) return 'Email delivery is not enabled for this address. Waylo needs its email service configured.';
  return 'This request couldn’t finish. Please try again. Your local trips are safe.';
}

export type AuthCallback = { kind: 'tokens'; accessToken: string; refreshToken: string; recovery: boolean } | { kind: 'code'; code: string; recovery: boolean } | { kind: 'hash'; tokenHash: string; type: 'email' | 'recovery'; recovery: boolean } | { kind: 'error'; message: string };
/** Only our exact callback destinations may establish a session. Never log this result. */
export function parseAuthCallback(raw: string, allowed: string[]): AuthCallback {
  const fail = (message = 'Open the newest confirmation or recovery link from your email.') => ({ kind: 'error' as const, message });
  if (raw.length > 24000) return fail();
  let url: URL;
  try { url = new URL(raw); } catch { return fail(); }
  if (url.username || url.password || !allowed.some((item) => { try { const candidate = new URL(item); return candidate.protocol === url.protocol && candidate.host === url.host && candidate.pathname.replace(/\/$/, '') === url.pathname.replace(/\/$/, ''); } catch { return false; } })) return fail('This sign-in link does not belong to Waylo. Request a new link from the app.');
  const query = new URLSearchParams(url.search); const fragment = new URLSearchParams(url.hash.slice(1));
  if (query.has('access_token') || query.has('refresh_token')) return fail('Use the newest email link from Waylo to establish a secure session.');
  if (['code', 'token_hash', 'access_token', 'refresh_token', 'type', 'error', 'error_code'].some((key) => query.getAll(key).length + fragment.getAll(key).length > 1)) return fail();
  const value = (key: string) => { const values = [...query.getAll(key), ...fragment.getAll(key)]; return values.length === 1 ? values[0] : undefined; };
  if (value('error') || value('error_code')) return fail(authMessage({ code: value('error_code') || 'otp_expired' }));
  const type = value('type'); const recovery = type === 'recovery';
  if (type && !['recovery', 'signup', 'email', 'magiclink', 'invite'].includes(type)) return fail();
  const code = value('code'), tokenHash = value('token_hash'), accessToken = value('access_token'), refreshToken = value('refresh_token');
  if ([!!code, !!tokenHash, !!accessToken].filter(Boolean).length !== 1) return fail();
  if (code && /^[A-Za-z0-9._~-]{10,2048}$/.test(code)) return { kind: 'code', code, recovery };
  if (tokenHash && /^[A-Za-z0-9_-]{20,512}$/.test(tokenHash) && ['email', 'signup', 'recovery'].includes(type ?? '')) return { kind: 'hash', tokenHash, type: recovery ? 'recovery' : 'email', recovery };
  if (accessToken && refreshToken && /^[A-Za-z0-9._-]{20,12000}$/.test(accessToken) && /^[A-Za-z0-9._~-]{10,2048}$/.test(refreshToken)) return { kind: 'tokens', accessToken, refreshToken, recovery };
  return fail();
}

export type CloudProfile = { user_id: string; full_name: string; home_city: string; created_at: string; updated_at: string };
export function accountIdentity(profile: CloudProfile | null, email?: string) { return { name: profile?.full_name.trim() || email?.split('@')[0] || 'Traveler', location: profile?.home_city ?? '' }; }
