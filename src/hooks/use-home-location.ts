import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTravel } from '@/components/travel-provider';
import { CityLookupError, manualHomeLocation, resolveCurrentCity, type CityStage } from '@/lib/current-city';
import { deviceCityAdapter } from '@/lib/device-city';

type Status = { phase: CityStage | 'needs-permission' | 'idle' | 'ready' | 'denied' | 'services-off' | 'error' | 'unsupported' | 'saving'; message: string; canAskAgain: boolean };
const idle: Status = { phase: Platform.OS === 'web' ? 'unsupported' : 'idle', message: '', canAskAgain: true };
export function useHomeLocation() {
  const { data, update } = useTravel(); const location = data?.homeLocation;
  const [status, setStatus] = useState<Status>(idle);
  const current = useRef<AbortController | null>(null); const saved = useRef(location); const manualSaving = useRef(false); const checked = useRef(0);
  useEffect(() => { saved.current = location; }, [location]);
  const cancel = useCallback(() => { current.current?.abort(); current.current = null; }, []);
  const refresh = useCallback(async (ask = true) => {
    if (Platform.OS === 'web' || current.current || manualSaving.current || (!ask && saved.current?.source === 'manual')) return false;
    const controller = new AbortController(); current.current = controller;
    const show = (phase: Status['phase'], message = '', canAskAgain = true) => { if (!controller.signal.aborted) setStatus({ phase, message, canAskAgain }); };
    try {
      const result = await resolveCurrentCity(deviceCityAdapter, { ask, signal: controller.signal, onStage: (stage) => show(stage) });
      if (controller.signal.aborted) return false;
      if (result.status !== 'ready') {
        show(result.status === 'permission' ? 'needs-permission' : result.status, result.status === 'services-off' ? 'Location services are off. Turn them on in device settings, or enter your city below.' : result.status === 'denied' ? 'Location access is off. You can allow it in settings or enter your city below.' : 'Allow location access to find your current city and country.', result.canAskAgain); return false;
      }
      try { await update((latest) => controller.signal.aborted ? latest : { ...latest, homeLocation: result.location }); }
      catch { throw new CityLookupError('Your city was found, but couldn’t be saved. Try again or enter it manually.'); }
      if (controller.signal.aborted) return false;
      checked.current = Date.now(); show('ready'); return true;
    } catch (cause) {
      if (!controller.signal.aborted) show('error', cause instanceof CityLookupError ? cause.message : 'We couldn’t find your city. Check your connection and location services, or enter it below.');
      return false;
    } finally { if (current.current === controller) current.current = null; }
  }, [update]);
  useFocusEffect(useCallback(() => {
    if (Date.now() - checked.current > 5 * 60 * 1000) void refresh(false);
    else setStatus((previous) => ['checking', 'permission', 'locating', 'geocoding'].includes(previous.phase) ? { ...idle, phase: 'idle' } : previous);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') cancel();
      if (state === 'active') void refresh(false);
    });
    return () => { cancel(); subscription.remove(); };
  }, [refresh, cancel]));
  const saveManual = async (city: string, country: string) => {
    if (manualSaving.current) return false;
    const next = manualHomeLocation(city, country); manualSaving.current = true; cancel(); setStatus({ ...idle, phase: 'saving' });
    try { await update((latest) => ({ ...latest, homeLocation: next })); saved.current = next; setStatus({ ...idle, phase: 'ready' }); return true; }
    catch { setStatus({ ...idle, phase: 'error', message: 'Your location couldn’t be saved. Please try again.' }); return false; }
    finally { manualSaving.current = false; }
  };
  const busy = ['checking', 'permission', 'locating', 'geocoding'].includes(status.phase);
  const label = location ? `${location.city}, ${location.country}` : busy ? 'Finding your city…' : 'Set your location';
  const caption = busy ? 'Updating location' : location?.source === 'manual' ? 'Manual location' : location ? status.phase === 'ready' ? 'Current location' : 'Last detected location' : status.phase === 'denied' ? 'Location access is off' : 'City & country';
  return { location, status, busy, label, caption, refresh, saveManual };
}
