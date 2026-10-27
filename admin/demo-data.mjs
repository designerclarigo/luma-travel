// Development data only. No Supabase client, credentials, mail or auth records.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
export const demoFile = new URL('./.demo/users.json', import.meta.url);
const names = [['Aisha Khan','Lahore'],['Arjun Mehta','Mumbai'],['Sofia Romano','Milan'],['Daniel Brooks','Austin'],['Mei Tan','Singapore'],['Amara Okafor','Lagos'],['Lucas Silva','São Paulo'],['Emma Wilson','London'],['Yuki Sato','Kyoto'],['Leila Haddad','Dubai'],['Mateo Garcia','Madrid'],['Priya Nair','Kochi']];
export function demoSeed() {
  return { version: 1, demo: true, users: names.map(([name, city], i) => ({
    id: `dddddddd-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, email: `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'.')}@example.test`,
    full_name: name, home_city: city, created_at: new Date(Date.UTC(2026, 7 + i % 3, 2 + i)).toISOString(),
    email_confirmed_at: i % 4 === 0 ? null : new Date(Date.UTC(2026, 7 + i % 3, 2 + i, 12)).toISOString(),
    last_sign_in_at: null, profile_updated_at: '2026-10-27T00:00:00.000Z', is_admin: false, shared_trips: 0, memberships: 0, has_backup: false, demo: true,
  })), audit: [] };
}
export async function seedDemo() {
  await mkdir(new URL('./.demo/', import.meta.url), { recursive: true });
  try { await writeFile(demoFile, JSON.stringify(demoSeed(), null, 2) + '\n', { flag: 'wx' }); return true; }
  catch (error) { if (error.code === 'EEXIST') return false; throw error; }
}
export async function loadDemoStore({ file = demoFile, clock = Date.now } = {}) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  if (data.version !== 1 || data.demo !== true || !Array.isArray(data.users) || data.users.length > 1000 || data.users.some(u => u.demo !== true || u.is_admin !== false || !u.email?.endsWith('@example.test') || !/^dddddddd-/.test(u.id))) throw new Error('Invalid isolated demo dataset.');
  let queue = Promise.resolve();
  const mutate = (fn) => {
    const next = queue.then(async () => {
      const draft = structuredClone(data); const result = fn(draft);
      const temp = new URL(`${file.href}.tmp`); await writeFile(temp, JSON.stringify(draft, null, 2) + '\n'); await rename(temp, file);
      Object.assign(data, draft); return result;
    });
    queue = next.catch(() => {}); return next;
  };
  const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
  const stamp = () => new Date(clock()).toISOString();
  return {
    async rpc(name, args = {}) {
      if (name === 'waylo_admin_users') {
        const q = args.search_text?.toLocaleLowerCase() || '';
        const items = data.users.filter(u => `${u.full_name} ${u.email}`.toLocaleLowerCase().includes(q));
        const page = args.page_number || 1;
        return { demo: true, total: items.length, page, page_size: 25, items: structuredClone(items.slice((page - 1) * 25, page * 25)) };
      }
      if (name === 'waylo_admin_overview') return { demo: true, users: data.users.length, verified_users: data.users.filter(u => u.email_confirmed_at).length, new_users_7d: 0, shared_trips: 0, packing_rows: 0, account_backups: 0, signups: [], recent_trips: [], audit: structuredClone(data.audit || []), as_of: stamp() };
      if (name === 'waylo_admin_trips') return { demo: true, total: 0, page: args.page_number || 1, page_size: 25, items: [] };
      if (name === 'waylo_admin_edit_profile') return mutate(draft => {
        const user = draft.users.find(u => u.id === args.target_user);
        if (!user) fail(404, 'This demo profile no longer exists.');
        if (user.profile_updated_at !== args.expected_updated_at) fail(409, 'This demo profile changed. Refresh users before editing again.');
        const updated = new Date(Math.max(clock(), Date.parse(user.profile_updated_at) + 1)).toISOString();
        Object.assign(user, { full_name: args.profile_name, home_city: args.profile_city, profile_updated_at: updated });
        draft.audit = [...(draft.audit || []), { action: 'user_profile_updated', created_at: updated, details: { demo: true } }].slice(-100);
        return { demo: true, user: structuredClone(user) };
      });
      fail(404, 'No published journey exists in the isolated demo dataset. Switch to live data to view real trips.');
    },
    invite(email, name) {
      if (!email.endsWith('@example.test')) fail(400, 'Demo mode accepts only @example.test addresses. No email will be sent.');
      return mutate(draft => {
        if (draft.users.some(u => u.email === email)) fail(409, 'This demo user already exists. Search users instead.');
        if (draft.users.length >= 1000) fail(409, 'The demo dataset is full.');
        const id = `dddddddd-0000-4000-8000-${String(Math.max(...draft.users.map(u => Number(u.id.slice(-12))), 0) + 1).padStart(12, '0')}`;
        const user = { ...demoSeed().users[0], id, email, full_name: name, home_city: '', created_at: stamp(), profile_updated_at: stamp(), email_confirmed_at: null };
        draft.users.push(user); draft.audit = [...(draft.audit || []), { action: 'user_invite_simulated', created_at: stamp(), details: { demo: true, outcome: 'simulated — no email sent' } }].slice(-100);
        return { demo: true, simulated: true, user, invitationRequested: false, deliveryVerified: false };
      });
    },
  };
}
