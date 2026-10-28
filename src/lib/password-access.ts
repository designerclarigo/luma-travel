import type { SupabaseClient } from '@supabase/supabase-js';
import { authMessage, cleanEmail, loginIssue, registrationIssue } from './auth-policy';
import { signedIn } from './email-otp-policy';
import { withDeadline } from './async-deadline';

/** Uses the supplied real Supabase Auth client. Never fabricates or stores a session. */
export async function passwordAccess(client: Pick<SupabaseClient, 'auth'>, input: { signup: boolean; email: string; password: string; confirmation?: string; name: string; redirectTo: string }) {
  const issue = input.signup ? registrationIssue({ fullName: input.name, email: input.email, password: input.password, confirmation: input.confirmation ?? '' }) : loginIssue(input.email, input.password);
  if (issue) throw new Error(issue);
  const credentials = { email: cleanEmail(input.email), password: input.password };
  const result = await withDeadline(input.signup ? client.auth.signUp({ ...credentials, options: { emailRedirectTo: input.redirectTo, data: { full_name: input.name.trim() } } })
    : client.auth.signInWithPassword(credentials), 25000, 'Your account request took too long. Check your connection and try again. If registration was accepted, finish email verification from Login.');
  if (result.error?.code === 'email_not_confirmed') return 'confirmation-needed' as const;
  if (result.error) throw new Error(authMessage(result.error));
  if (result.data.session && signedIn(result.data.session)) return 'signed-in' as const;
  if (input.signup) return 'verification-sent' as const;
  throw new Error('A verified sign-in could not be established. Please try again.');
}
