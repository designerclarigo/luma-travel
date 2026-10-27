import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isPublicSupabaseKey, projectUrl } from './service-connection';
import { createSecureAuthStorage } from './auth-storage';
const url = projectUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const key = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim();
export const cloudConfigured = !!url && isPublicSupabaseKey(key);
const secureStorage = createSecureAuthStorage({
  getItemAsync: SecureStore.getItemAsync,
  setItemAsync: (name, value) => SecureStore.setItemAsync(name, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  deleteItemAsync: SecureStore.deleteItemAsync,
});
const storage = Platform.OS === 'web' ? {
  getItem: async (name: string) => typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(name),
  setItem: async (name: string, value: string) => { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(name, value); },
  removeItem: async (name: string) => { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(name); },
} : secureStorage;
export const cloud = cloudConfigured ? createClient(url!, key!, { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null;
export function requireCloud() { if (!cloud) throw new Error('Cloud sharing is not configured for this build. Local sharing and backups are available.'); return cloud; }
export async function checkCloudConnection() {
  const client = requireCloud();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again before checking cloud access.');
  const { data, error } = await client.rpc('waylo_status');
  if (error || data?.schema !== 1 || data?.collaboration !== true || data?.backup !== true) throw new Error('Cloud sign-in works, but the Waylo database setup is missing or out of date. Apply backend/supabase.sql to the same Supabase project.');
  const [rooms, backup] = await Promise.all([
    client.from('waylo_rooms').select('id').limit(1),
    client.from('waylo_backups').select('user_id').eq('user_id', auth.user.id).limit(1),
  ]);
  if (rooms.error || backup.error) throw new Error('Database permissions could not be verified. Check the Waylo migration and RLS policies.');
  return 'Sign-in, database schema and your read access are connected. Publishing and backup writes require a separate live test.';
}
