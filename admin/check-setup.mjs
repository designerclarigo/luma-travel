// Sanitized diagnostics: no credentials or provider response bodies are printed.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { adminConfig, loadEnvironment } from './config.mjs';
import { parseEnv } from 'node:util';
import { verificationEnvironment } from './verification.mjs';
const env = loadEnvironment(), config = adminConfig(env), root = new URL('../', import.meta.url);
const testFile = new URL('admin/.env.test.local', root);
const verification = verificationEnvironment(env, existsSync(testFile) ? parseEnv(readFileSync(testFile, 'utf8')) : {});
const report = { checkedAt: new Date().toISOString(), projectConfigured: config.configured, missing: config.issues, invitationConfigured: config.invitationsConfigured, invitationMissing: config.inviteIssues, migrations: [], databaseInstallation: 'Not verified by this command', smtp: 'Managed in Supabase; no SMTP settings are inferred from local files', network: 'Not requested' };
for (const [source, target] of [['backend/supabase.sql','supabase/migrations/20261026000100_waylo_backend.sql'],['backend/admin.sql','supabase/migrations/20261026000200_waylo_admin.sql'],['backend/auth-profiles.sql','supabase/migrations/20261027000100_waylo_auth_profiles.sql'],['backend/user-management.sql','supabase/migrations/20261027000200_waylo_user_management.sql']]) {
  report.migrations.push({ source, stagedCopyMatches: existsSync(new URL(target, root)) && readFileSync(new URL(source, root),'utf8') === readFileSync(new URL(target, root),'utf8') });
}
report.access = Object.fromEntries(['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_DB_URL','ADMIN_TEST_EMAIL','ADMIN_TEST_PASSWORD','ADMIN_NORMAL_TEST_EMAIL','ADMIN_NORMAL_TEST_PASSWORD'].map(key => [key, verification[key]?.trim() ? 'present' : 'absent']));
if (process.argv.includes('--network') && config.configured) {
  try {
    const response = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.key }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) { report.network = `Auth settings returned HTTP ${response.status}; configuration is not verified`; process.exitCode = 1; }
    else { const data = await response.json(); report.network = 'Real Supabase Auth settings reachable'; report.auth = { emailEnabled: data.external?.email === true, signupDisabled: data.disable_signup === true, emailAutoConfirm: data.mailer_autoconfirm === true }; }
  } catch { report.network = 'Auth service unreachable; check network access. No provider body was logged'; process.exitCode = 1; }
}
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--report')) writeFileSync(new URL('docs/verification/admin-setup-current.json', root), JSON.stringify(report, null, 2) + '\n');
if (!process.exitCode && (!config.configured || !config.invitationsConfigured || report.migrations.some(m => !m.stagedCopyMatches))) process.exitCode = 2;
