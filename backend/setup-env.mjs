import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
for (const [source, target] of [['.env.example', '.env.local'], ['backend/.env.example', 'backend/.env.local'], ['backend/verification.env.example', 'backend/verification.env.local']]) {
  if (existsSync(new URL(target, root))) console.log(`${target}: preserved existing file`);
  else { copyFileSync(new URL(source, root), new URL(target, root), constants.COPYFILE_EXCL); console.log(`${target}: created blank credential template`); }
}
const migration = new URL('supabase/migrations/20261026000100_waylo_backend.sql', root);
const sql = readFileSync(new URL('backend/supabase.sql', root), 'utf8');
if (existsSync(migration) && readFileSync(migration, 'utf8') !== sql) {
  console.error('The existing migration differs from backend/supabase.sql. Add a NEW migration; never overwrite a deployed migration.');
  process.exitCode = 1;
} else if (!existsSync(migration)) {
  mkdirSync(fileURLToPath(new URL('./', migration)), { recursive: true });
  writeFileSync(migration, sql, { flag: 'wx' }); console.log('Supabase initial migration prepared. No database was contacted.');
}
