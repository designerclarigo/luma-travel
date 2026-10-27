type Vault = { getItemAsync: (key: string) => Promise<string | null>; setItemAsync: (key: string, value: string) => Promise<void>; deleteItemAsync: (key: string) => Promise<void> };
type Manifest = { version: 1; keys: string[] };
const manifestOf = (raw: string | null): Manifest | null => {
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.keys) || value.keys.length > 256 || !value.keys.every((key: unknown) => typeof key === 'string' && /^[\w.-]+$/.test(key))) throw new Error('Secure session storage could not be read.');
  return value;
};
function chunks(value: string) {
  const parts: string[] = []; let part = '', bytes = 0;
  for (const char of value) { const p = char.codePointAt(0)!; const size = p < 128 ? 1 : p < 2048 ? 2 : p < 65536 ? 3 : 4; if (bytes + size > 1600) { parts.push(part); part = ''; bytes = 0; } part += char; bytes += size; }
  parts.push(part); if (parts.length > 256) throw new Error('Account session is too large to store securely.'); return parts;
}
/** Every secret remains in the encrypted vault. Publish the manifest only after all chunks exist. */
export function createSecureAuthStorage(vault: Vault) {
  let queue: Promise<unknown> = Promise.resolve(); let generation = 0;
  const ordered = <T>(work: () => Promise<T>): Promise<T> => { const result = queue.then(work, work); queue = result.catch(() => {}); return result; };
  const cleanup = async (keys: string[]) => { await Promise.all(keys.map((key) => vault.deleteItemAsync(key).catch(() => {}))); };
  return {
    getItem: (key: string) => ordered(async () => {
      const manifest = manifestOf(await vault.getItemAsync(`${key}.manifest`));
      if (!manifest) return vault.getItemAsync(key); // Existing installations keep their current session.
      if (!manifest.keys.length) return null; // A logout tombstone prevents a stale legacy value returning.
      if (manifest.keys.some((part) => !part.startsWith(`${key}.part.`))) throw new Error('Secure session storage is invalid.');
      const parts = await Promise.all(manifest.keys.map((part) => vault.getItemAsync(part)));
      if (parts.some((part) => part === null)) throw new Error('Your secure session is incomplete. Please sign in again.');
      return parts.join('');
    }),
    setItem: (key: string, value: string) => ordered(async () => {
      const raw = await vault.getItemAsync(`${key}.manifest`); let old: Manifest | null = null;
      try { old = manifestOf(raw); } catch { /* A new authenticated session can replace damaged vault metadata. */ }
      if (old?.keys.some((part) => !part.startsWith(`${key}.part.`))) old = null;
      const suffix = `${Date.now().toString(36)}${(++generation).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const values = chunks(value); const keys = values.map((_, i) => `${key}.part.${suffix}.${i}`);
      try { for (let i = 0; i < keys.length; i++) await vault.setItemAsync(keys[i], values[i]); await vault.setItemAsync(`${key}.manifest`, JSON.stringify({ version: 1, keys })); }
      catch (error) { await cleanup(keys); throw error; }
      await cleanup([key, ...(old?.keys ?? [])]);
    }),
    removeItem: (key: string) => ordered(async () => {
      const raw = await vault.getItemAsync(`${key}.manifest`); let old: Manifest | null = null;
      try { old = manifestOf(raw); } catch { /* Logout can still publish a tombstone if metadata is damaged. */ }
      if (old?.keys.some((part) => !part.startsWith(`${key}.part.`))) old = null;
      await vault.setItemAsync(`${key}.manifest`, JSON.stringify({ version: 1, keys: [] }));
      await cleanup([key, ...(old?.keys ?? [])]);
    }),
  };
}
