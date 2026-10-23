import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTravelStore, type TravelState } from '@/lib/travel-state';

type TravelContextValue = {
  data: TravelState | null; loading: boolean; error: boolean; retry: () => void;
  update: (change: (value: TravelState) => TravelState) => Promise<void>;
};
const TravelContext = createContext<TravelContextValue | null>(null);

export function TravelProvider({ children }: PropsWithChildren) {
  const store = useMemo(() => createTravelStore(AsyncStorage), []);
  const [data, setData] = useState<TravelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void store.load().then((value) => { if (alive) setData(value); }).catch((cause: unknown) => {
      console.error('Unable to load Waylo travel data.', cause); if (alive) setError(true);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attempt, store]);
  const retry = useCallback(() => { setLoading(true); setError(false); setAttempt((value) => value + 1); }, []);
  const update = useCallback(async (change: (value: TravelState) => TravelState) => { setData(await store.update(change)); }, [store]);
  return <TravelContext.Provider value={{ data, loading, error, retry, update }}>{children}</TravelContext.Provider>;
}
export function useTravel() {
  const value = useContext(TravelContext);
  if (!value) throw new Error('TravelProvider is missing.');
  return value;
}
