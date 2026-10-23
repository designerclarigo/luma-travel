import { type Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { cloud } from '@/lib/cloud-client';
const Context = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: false });
export function CloudProvider({ children }: PropsWithChildren) { const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(!!cloud); useEffect(() => { if (!cloud) return; let alive = true; void cloud.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setLoading(false); } }).catch(() => { if (alive) setLoading(false); }); const subscription = cloud.auth.onAuthStateChange((_, next) => { if (alive) setSession(next); }); if (AppState.currentState === 'active') cloud.auth.startAutoRefresh(); const app = AppState.addEventListener('change', (state) => { if (state === 'active') cloud?.auth.startAutoRefresh(); else cloud?.auth.stopAutoRefresh(); }); return () => { alive = false; subscription.data.subscription.unsubscribe(); app.remove(); cloud?.auth.stopAutoRefresh(); }; }, []); return <Context.Provider value={{ session, loading }}>{children}</Context.Provider>; }
export const useCloud = () => useContext(Context);
