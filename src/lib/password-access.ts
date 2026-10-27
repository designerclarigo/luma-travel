import type { SupabaseClient } from '@supabase/supabase-js';
import { authMessage, cleanEmail, loginIssue, passwordIssue } from './auth-policy';
import { emailCodeIssue, signedIn } from './email-otp-policy';

/** Uses the supplied real Supabase Auth client. Never fabricates or stores a session. */
export async function passwordAccess(client: Pick<SupabaseClient, 'auth'>, input: { signup: boolean; email: string; password: string; name: string; redirectTo: string }) {
  const issue = input.signup ? emailCodeIssue(input.email, input.name) || passwordIssue(input.password, input.password) : loginIssue(input.email, input.password);
  if (issue) throw new Error(issue);
  const credentials = { email: cleanEmail(input.email), password: input.password };
  const result = input.signup ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: input.redirectTo, data: { full_name: input.name.trim() } } })
    : await client.auth.signInWithPassword(credentials);
  if (result.error?.code === 'email_not_confirmed') return 'confirmation-needed' as const;
  if (result.error) throw new Error(authMessage(result.error));
  if (result.data.session && signedIn(result.data.session)) return 'signed-in' as const;
  if (input.signup) return 'verification-sent' as const;
  throw new Error('A verified sign-in could not be established. Try email-code login.');
}
