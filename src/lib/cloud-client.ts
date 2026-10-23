import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const cloudConfigured = !!url && !!key && /^https:\/\//.test(url);
const storage = { getItem: async (name: string) => Platform.OS === 'web' ? typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(name) : SecureStore.getItemAsync(name), setItem: async (name: string, value: string) => { if (Platform.OS === 'web') { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(name, value); } else await SecureStore.setItemAsync(name, value); }, removeItem: async (name: string) => { if (Platform.OS === 'web') { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(name); } else await SecureStore.deleteItemAsync(name); } };
export const cloud = cloudConfigured ? createClient(url!, key!, { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null;
export function requireCloud() { if (!cloud) throw new Error('Cloud sharing is not configured for this build. Local sharing and backups are available.'); return cloud; }
