import { type Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { cloud, requireCloud } from '@/lib/cloud-client';
import { authMessage, type CloudProfile } from '@/lib/auth-policy';
import { finishAuthCallback, readCloudProfile, writeCloudProfile } from '@/lib/auth-service';
import { type EmailCodeRequest } from '@/lib/email-otp-policy';
import { withDeadline } from '@/lib/async-deadline';

type CloudContext = {
  session: Session | null; loading: boolean; sessionError: string; sessionNotice: string;
  profile: CloudProfile | null; profileLoading: boolean; profileError: string;
  pendingEmail: string; setPendingEmail: (email: string) => void;
  otpRequest: EmailCodeRequest | null; setOtpRequest: (request: EmailCodeRequest | null) => void;
  recovery: { userId: string; expiresAt: number } | null;
  refreshProfile: () => void; saveIdentity: (identity: { name: string; location: string }) => Promise<void>;
  completeCallback: (url: string) => Promise<{ recovery: boolean; userId: string }>;
  authorizeRecovery: (userId: string) => void; clearRecovery: () => void; logout: () => Promise<void>;
};
const Context = createContext<CloudContext | null>(null);
export function CloudProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!cloud), [sessionError, setSessionError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [profileRequest, setProfileRequest] = useState<{ userId: string; attempt: number; profile: CloudProfile | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0), [pendingEmail, setPendingEmail] = useState('');
  const [otpRequest, setOtpRequest] = useState<EmailCodeRequest | null>(null);
  const [recovery, setRecovery] = useState<CloudContext['recovery']>(null);
  const authorizeRecovery = useCallback((userId: string) => setRecovery({ userId, expiresAt: Date.now() + 15 * 60 * 1000 }), []);
  const clearRecovery = useCallback(() => setRecovery(null), []);
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    void withDeadline(cloud.auth.getSession(), 20000, 'Sign-in restoration timed out.').then(({ data, error }) => { if (alive) { setSession(data.session); setSessionError(error ? authMessage(error) : ''); setLoading(false); } }).catch(() => { if (alive) { setSessionError('Your saved sign-in couldn’t be restored. Check your connection and sign in again. Your local trips are safe.'); setLoading(false); } });
    // Keep this callback synchronous: awaiting another auth method here can deadlock the auth lock.
    const listener = cloud.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next); setLoading(false); setSessionError('');
      if (next) setSessionNotice('');
      if (event === 'PASSWORD_RECOVERY' && next) authorizeRecovery(next.user.id);
      if (!next) { setProfileRequest(null); setRecovery(null); }
    });
    if (AppState.currentState === 'active') cloud.auth.startAutoRefresh();
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') cloud?.auth.startAutoRefresh(); else cloud?.auth.stopAutoRefresh(); });
    return () => { alive = false; listener.data.subscription.unsubscribe(); app.remove(); cloud?.auth.stopAutoRefresh(); };
  }, [authorizeRecovery]);
  useEffect(() => {
    if (!recovery) return;
    const timer = setTimeout(() => setRecovery((current) => current?.expiresAt === recovery.expiresAt ? null : current), Math.max(0, recovery.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [recovery]);
  const userId = session?.user.id;
  useEffect(() => {
    let alive = true;
    if (!userId) return;
    void withDeadline(readCloudProfile(userId), 20000, 'Profile request timed out.').then((value) => { if (alive) setProfileRequest({ userId, attempt, profile: value, error: '' }); }).catch((error: unknown) => { if (alive) setProfileRequest((old) => ({ userId, attempt, profile: old?.userId === userId ? old.profile : null, error: authMessage(error) })); });
    return () => { alive = false; };
  }, [attempt, userId]);
  const profile = profileRequest?.userId === userId ? profileRequest?.profile ?? null : null;
  const profileLoading = !!userId && (profileRequest?.userId !== userId || profileRequest?.attempt !== attempt);
  const profileError = profileRequest?.userId === userId && profileRequest?.attempt === attempt ? profileRequest?.error ?? '' : '';
  const refreshProfile = useCallback(() => setAttempt((value) => value + 1), []);
  const saveIdentity = useCallback(async (identity: { name: string; location: string }) => {
    if (!userId) throw new Error('Sign in before updating your account profile.');
    if (profileLoading) throw new Error('Your account profile is still loading. Please try again in a moment.');
    const value = await writeCloudProfile(userId, identity); setProfileRequest({ userId, attempt, profile: value, error: '' });
  }, [attempt, profileLoading, userId]);
  const completeCallback = useCallback(async (url: string) => {
    const result = await finishAuthCallback(url);
    if (result.recovery) authorizeRecovery(result.userId);
    return result;
  }, [authorizeRecovery]);
  const logout = useCallback(async () => {
    const client = requireCloud(); const { error } = await withDeadline(client.auth.signOut({ scope: 'local' }), 25000, 'Sign out could not finish. Check your connection and try again.');
    if (error) {
      // Current Supabase clears this device even on a network-revocation failure. Verify that outcome.
      const local = await withDeadline(client.auth.getSession(), 10000, 'We couldn’t verify that this device signed out. Please try again.');
      if (local.error || local.data.session) throw new Error(authMessage(error));
    }
    setSessionNotice(error ? 'Signed out on this device. Server-side revocation couldn’t be verified while offline.' : 'Signed out on this device. Your local journeys are still saved.');
    setSession(null); setProfileRequest(null); setPendingEmail(''); setOtpRequest(null); setRecovery(null);
    // TravelProvider is deliberately untouched: device trips and packing remain saved.
  }, []);
  return <Context.Provider value={{ session, loading, sessionError, sessionNotice, profile, profileLoading, profileError, pendingEmail, setPendingEmail, otpRequest, setOtpRequest, recovery, refreshProfile, saveIdentity, completeCallback, authorizeRecovery, clearRecovery, logout }}>{children}</Context.Provider>;
}
export function useCloud() { const value = useContext(Context); if (!value) throw new Error('CloudProvider is missing.'); return value; }
