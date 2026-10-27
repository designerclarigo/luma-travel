import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDate } from '@/lib/dates';

export function useCurrentDate() {
  const [today, setToday] = useState(() => localDate());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); setToday(localDate()); const next = new Date(); next.setHours(24, 0, 1, 0); timer = setTimeout(refresh, next.getTime() - Date.now()); };
    refresh(); const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return today;
}
