import { cleanEmail, validEmail } from './auth-policy';
export type EmailCodeRequest = { email: string; name: string; mode: 'login' | 'signup'; method?: 'password' | 'code'; requestedAt: number; nextSendAt: number; invite?: string };
export function emailCodeIssue(email: string, name = '') {
  if (!validEmail(cleanEmail(email))) return 'Enter a valid email address.';
  if (name.trim() && (name.trim().length < 2 || name.trim().length > 100 || /[\x00-\x1f\x7f]/.test(name))) return 'Use 2–100 characters for your name, or leave it empty.';
  return '';
}
export function codeIssue(code: string) { return /^\d{6,10}$/.test(code.trim()) ? '' : 'Enter the complete numeric code from your email.'; }
export function resendSeconds(nextSendAt: number, now: number) { return Math.max(0, Math.ceil((nextSendAt - now) / 1000)); }
export function signedIn(session: { user: { email_confirmed_at?: string | null } } | null) { return !!session?.user.email_confirmed_at; }
export function entryDestination(completed: boolean, session: Parameters<typeof signedIn>[0]) { return !completed ? '/' : signedIn(session) ? '/home' : '/login'; }
