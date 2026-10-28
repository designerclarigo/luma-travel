import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reports contain check names/status only, never environment values or provider bodies.
export function verificationReport() {
  return { checkedAt: new Date().toISOString(), status: 'BLOCKED', checks: [], blocked: [], authenticatedLive: 'not performed', physicalPhone: 'not tested' };
}
export function saveVerificationReport(path, report) {
  const file = path instanceof URL ? fileURLToPath(path) : path;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
}
export function assertPermissionDenied(status, body) {
  // An invalid API key, missing RPC or network failure is not proof of DB denial.
  if (![401, 403].includes(status) || body?.code !== '42501') throw new Error('Database permission denial was not verified.');
}
export function assertProfileVisibility(row, user, profile, isAdmin) {
  const sameDate = (a, b) => typeof a === 'string' && typeof b === 'string' && Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b);
  if (!row || !user || !profile || profile.user_id !== user.id || row.id !== user.id
    || typeof user.email !== 'string' || typeof row.email !== 'string' || row.email.toLowerCase() !== user.email.toLowerCase()
    || typeof profile.full_name !== 'string' || typeof profile.home_city !== 'string'
    || row.full_name !== profile.full_name || row.home_city !== profile.home_city
    || !sameDate(row.profile_updated_at, profile.updated_at) || !sameDate(row.email_confirmed_at, user.email_confirmed_at)
    || typeof isAdmin !== 'boolean' || row.is_admin !== isAdmin || row.demo === true) {
    throw new Error('User/profile visibility does not match canonical confirmed account data.');
  }
}
