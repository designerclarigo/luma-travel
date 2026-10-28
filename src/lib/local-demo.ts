import { initialTravelState, travelStorageKey } from './travel-state';

export const localDemoSessionKey = '@waylo/local-demo/session/v1';
export const localDemoDataPrefix = '@waylo/local-demo/data/';
export const localDemoName = 'Demo Traveler';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };

/** Local development access only. Never creates a User, JWT, password or Supabase session. */
export function localDemoActive(development: boolean, requested: boolean, hasCloudSession: boolean) {
  return development && requested && !hasCloudSession;
}
export function createLocalDemoAccess(storage: Storage, development: boolean) {
  const requireDevelopment = () => { if (!development) throw new Error('Local demo is available in development builds only.'); };
  return {
    restore: async () => development && await storage.getItem(localDemoSessionKey) === 'local-demo-v1',
    start: async () => { requireDevelopment(); await storage.setItem(localDemoSessionKey, 'local-demo-v1'); },
    stop: async () => { requireDevelopment(); await storage.removeItem(localDemoSessionKey); },
  };
}

/** Demo edits cannot read, overwrite or erase the regular device collection. */
export function createDemoTravelStorage(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  return {
    getItem: async (key: string) => {
      const saved = await storage.getItem(localDemoDataPrefix + key);
      return saved === null && key === travelStorageKey ? JSON.stringify({ ...initialTravelState, profile: { name: localDemoName, location: '' } }) : saved;
    },
    setItem: (key: string, value: string) => storage.setItem(localDemoDataPrefix + key, value),
  };
}
