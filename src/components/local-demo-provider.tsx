import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createLocalDemoAccess, localDemoActive } from '@/lib/local-demo';
import { signedIn } from '@/lib/email-otp-policy';
import { withDeadline } from '@/lib/async-deadline';
import { useCloud } from './cloud-provider';

type DemoAccess = { available: boolean; active: boolean; loading: boolean; error: string; start: () => Promise<void>; stop: () => Promise<void> };
const Context = createContext<DemoAccess | null>(null);
export function LocalDemoProvider({ children }: PropsWithChildren) {
  const cloud = useCloud();
  const available = __DEV__;
  const store = useMemo(() => createLocalDemoAccess(AsyncStorage, available), [available]);
  const [requested, setRequested] = useState(false), [loading, setLoading] = useState(available), [error, setError] = useState('');
  const cloudUser = cloud.session?.user.id;
  useEffect(() => {
    if (!available || cloud.loading) return;
    let alive = true;
    const restore = cloudUser ? store.stop().then(() => false) : store.restore();
    void withDeadline(restore, 8000, 'Local demo could not be restored.').then((value) => { if (alive) { setRequested(value); setError(''); } }).catch(() => { if (alive) { setRequested(false); setError('Local demo access could not be read. Try entering the demo again.'); } }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [available, cloud.loading, cloudUser, store]);
  const start = useCallback(async () => {
    if (cloud.loading || loading) throw new Error('Please wait for account restoration to finish.');
    if (cloud.session) throw new Error('Sign out of your real account before entering the local demo.');
    await withDeadline(store.start(), 8000, 'Demo access could not be saved. Please try again.');
    setRequested(true); setError('');
  }, [cloud.loading, cloud.session, loading, store]);
  const stop = useCallback(async () => {
    await withDeadline(store.stop(), 8000, 'Demo exit could not be saved. Please try again.');
    setRequested(false); setError('');
  }, [store]);
  return <Context.Provider value={{ available, active: localDemoActive(available, requested, !!cloud.session), loading: loading || cloud.loading, error, start, stop }}>{children}</Context.Provider>;
}
export function useLocalDemo() { const value = useContext(Context); if (!value) throw new Error('LocalDemoProvider is missing.'); return value; }
export function useAppAccess() { const demo = useLocalDemo(); const { session } = useCloud(); return { canExplore: signedIn(session) || demo.active, loading: demo.loading }; }
