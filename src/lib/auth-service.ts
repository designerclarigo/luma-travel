import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { requireCloud } from './cloud-client';
import { authMessage, cleanEmail, parseAuthCallback, type CloudProfile } from './auth-policy';
import { withDeadline } from './async-deadline';

export function authRedirectUrl() { return Linking.createURL('auth/callback'); }
export function allowedAuthCallbacks() {
  const callbacks = [authRedirectUrl()];
  if (Platform.OS !== 'web') callbacks.push('waylo://auth/callback');
  return callbacks;
}
/** Remove bearer credentials from web history before starting any network request. */
export function scrubAuthUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') { window.history.replaceState(null, '', '/auth/callback'); document.title = 'Waylo'; }
  else Linking.clearInitialURL();
}
export async function finishAuthCallback(raw: string) {
  const callback = parseAuthCallback(raw, allowedAuthCallbacks());
  scrubAuthUrl();
  if (callback.kind === 'error') throw new Error(callback.message);
  const client = requireCloud();
  const result = callback.kind === 'tokens'
    ? await client.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken })
    : callback.kind === 'code'
      ? await client.auth.exchangeCodeForSession(callback.code)
      : await client.auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type });
  if (result.error) throw new Error(authMessage(result.error));
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at) throw new Error('We couldn’t verify this email link. Request a fresh one and try again.');
  const recovery = callback.recovery || ('redirectType' in result.data && result.data.redirectType === 'recovery');
  return { recovery, userId: data.user.id };
}
export async function readCloudProfile(userId: string): Promise<CloudProfile> {
  const { data, error } = await requireCloud().from('waylo_profiles').select('user_id,full_name,home_city,created_at,updated_at').eq('user_id', userId).single();
  if (error) throw error;
  return data;
}
export async function writeCloudProfile(userId: string, identity: { name: string; location: string }): Promise<CloudProfile> {
  const name = identity.name.trim(), location = identity.location.trim();
  if (name.length < 2 || name.length > 100 || location.length > 100 || /[\x00-\x1f\x7f]/.test(name + location)) throw new Error('Use a name of 2–100 characters and a home location under 100 characters.');
  const { data, error } = await requireCloud().from('waylo_profiles').update({ full_name: name, home_city: location }).eq('user_id', userId).select('user_id,full_name,home_city,created_at,updated_at').single();
  if (error) throw new Error(authMessage(error));
  return data;
}
export async function registerAccount(fullName: string, email: string, password: string) {
  return requireCloud().auth.signUp({ email: cleanEmail(email), password, options: { emailRedirectTo: authRedirectUrl(), data: { full_name: fullName.trim() } } });
}
export async function resendConfirmation(email: string) { return withDeadline(requireCloud().auth.resend({ type: 'signup', email: cleanEmail(email), options: { emailRedirectTo: authRedirectUrl() } }), 25000, 'The verification request timed out. Check your inbox before trying again; a request may have reached the email service.'); }
export async function sendRecovery(email: string) { return withDeadline(requireCloud().auth.resetPasswordForEmail(cleanEmail(email), { redirectTo: authRedirectUrl() }), 25000, 'The recovery request timed out. Check your inbox before requesting another email.'); }
