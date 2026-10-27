import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const local = new URL('admin/.env.local', root);
if (!existsSync(local)) { copyFileSync(new URL('admin/.env.example', root), local, constants.COPYFILE_EXCL); console.log('Created admin/.env.local with blank project settings.'); }
else console.log('Preserved existing admin/.env.local.');
const testLocal = new URL('admin/.env.test.local', root);
if (!existsSync(testLocal)) { copyFileSync(new URL('admin/.env.test.example', root), testLocal, constants.COPYFILE_EXCL); console.log('Created optional blank admin/.env.test.local.'); }
const migration = new URL('supabase/migrations/20261026000200_waylo_admin.sql', root);
const sql = readFileSync(new URL('backend/admin.sql', root), 'utf8');
if (existsSync(migration) && readFileSync(migration, 'utf8') !== sql) { console.error('Existing admin migration differs. Prepare a new migration instead of overwriting a deployed one.'); process.exitCode = 1; }
else if (!existsSync(migration)) { mkdirSync(fileURLToPath(new URL('./', migration)), { recursive: true }); writeFileSync(migration, sql, { flag: 'wx' }); console.log('Prepared additive admin migration. No database was contacted.'); }
for (const [source, target] of [['backend/auth-profiles.sql','supabase/migrations/20261027000100_waylo_auth_profiles.sql'],['backend/user-management.sql','supabase/migrations/20261027000200_waylo_user_management.sql']]) {
  const expected = readFileSync(new URL(source, root), 'utf8'); const path = new URL(target, root);
  if (existsSync(path) && readFileSync(path,'utf8') !== expected) { console.error(`Existing ${target} differs. Add a new migration; do not overwrite deployed SQL.`); process.exitCode=1; }
  else if (!existsSync(path)) { mkdirSync(fileURLToPath(new URL('./',path)), {recursive:true}); writeFileSync(path,expected,{flag:'wx'}); console.log(`Prepared ${target}. No database was contacted.`); }
}
