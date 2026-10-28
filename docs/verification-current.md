# Current verification — 28 October 2026

This audit supersedes older success counts for the checks below. Authenticated live checks were deliberately **not performed**. No migration, account/grant change, invitation, cloud write, email request or AI request was made. Existing mobile data, UI and navigation were preserved.

## Changes

- `backend/verify-live.mjs` and `admin/verify-live.mjs` replace their report immediately, then save the final result on blocked, passed and failed paths. Missing credentials produce fresh `BLOCKED` reports with empty check arrays and a nonzero exit (Node exit code 2). Setup errors produce sanitized `FAILED` reports. Old success results cannot survive these early exits.
- Authenticated acceptance now requires an explicit `--authenticated` opt-in. It was **not** supplied in this audit. The backend acceptance command can create/delete its own temporary trip/backup, so it must remain a separately authorized acceptance task.
- `backend/verification.mjs` checks actual PostgreSQL permission denial (`401/403` **and** `42501`). Invalid API keys, missing RPCs, outages and generic errors do not count as permission proof. Profile checks compare canonical user ID/email/confirmation with the user's actual profile name/city/version and database admin status; demo rows and editable metadata cannot satisfy them.
- `backend/verify-public.mjs` is a separate read-only, unauthenticated check command. It never requests a password token, sends email, calls AI, executes SQL or calls mutation RPCs.
- `admin/verification.mjs` restricts private test-file overrides to the four test-credential names, preserving passwords exactly. `admin/check-setup.mjs` now includes that private file in presence-only diagnostics, and unsuccessful network checks cannot exit successfully. No values are logged.
- `backend/config.mjs` / `backend/check-setup.mjs` explain invalid assistant configuration without serializing the supplied URL. `admin/build.mjs` syntax-checks the new server-side helper without publishing it.
- `scripts/verification.test.cjs` adds report-freshness, opt-in, redaction, canonical-profile, real-denial semantics and prepared-migration checks. `scripts/admin.test.cjs` adds profile-metadata privilege denial and canonical user-search response coverage. `package.json` adds `verify:public` and includes verification regressions in `backend:test`.

## Commands actually completed

Run from `D:\vi\MyApp` using Windows PowerShell:

| Command | Current result |
| --- | --- |
| `npm.cmd run backend:test` | **25 passed**, 0 failed |
| `npm.cmd test` | **200 passed**, 0 failed; includes backend/admin suites, counts overlap |
| `npm.cmd run admin:test` | **26 passed**, 0 failed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run admin:build` | Passed; 7 assets, valid JavaScript, no CSS warnings |
| `npm.cmd run verify:public` | **8 check groups passed** against running servers and real Supabase, without signing in |
| `npm.cmd run backend:verify-live` | **BLOCKED**, no service calls; fresh report saved |
| `npm.cmd run admin:verify-live` | **BLOCKED**, no service calls; fresh report saved |
| `npm.cmd run backend:check -- --report` | Expected incomplete result: app assistant URL is missing |
| `npm.cmd run admin:check -- --report` | Expected incomplete result: server-only invitation key is missing |

Automated backend/admin authentication tests use controlled upstream adapters. Their passing results do **not** establish current real login, profile visibility, invitation delivery or RLS behavior for signed-in accounts. No mobile production export or physical-device/browser interaction was performed in this audit.

The first public run failed because network access was restricted and local servers were stopped. The same read-only checks were rerun with network access after starting the existing servers; the final report contains the successful current result.

## Real public checks

- Admin assets and health/readiness return 200 with expected no-store, CSP and nosniff headers. Anonymous sessions contain no user or CSRF token. All 16 data-route/header combinations reject anonymous/forged/demo claims with 401.
- Env files, demo JSON and nonpublic server modules return 404. A cross-origin logout POST is rejected with 403 before any mutation.
- The real configured Supabase Auth settings are reachable: email enabled, signup enabled, email auto-confirm disabled. This is **not** an email delivery or login test.
- Anonymous reads of all seven Waylo tables (`rooms`, `members`, `invites`, `backups`, `profiles`, `admins`, `admin_audit`) receive HTTP 401/403 with PostgreSQL `42501`.
- Anonymous calls to six read RPCs (`waylo_status`, `waylo_admin_status`, `waylo_admin_overview`, `waylo_admin_users`, `waylo_admin_trips`, `waylo_admin_trip`) receive the same actual permission denial. POST here invokes read-only functions; no mutation RPC was called.
- The local assistant returns health 200 and readiness 200 (`configured:true`). Required local configuration is present; its actual OpenAI/Supabase credential validity and model access were **not** tested.

Current sanitized evidence: [public checks](verification/public-security-current.json), [blocked backend acceptance](verification/backend-live.json), [blocked admin acceptance](verification/admin-live.json), [backend configuration](verification/backend-setup.json), [admin configuration](verification/admin-setup-current.json), [command summary](verification/verification-current.json).

## RLS and prepared migrations

Reviewed all four source migrations and confirmed byte-for-byte equality with their prepared copies:

1. `backend/supabase.sql` → `20261026000100_waylo_backend.sql`: member-only room/member reads; RPC-controlled room writes; private invitations; owner-only backup read/write policy.
2. `backend/admin.sql` → `20261026000200_waylo_admin.sql`: RLS on the admin allowlist/audit, no direct public/anon/authenticated table privileges, active grant checked against `auth.uid()`, guarded admin RPCs, empty security-definer search paths, confirmation/revision checks for deletion.
3. `backend/auth-profiles.sql` → `20261027000100_waylo_auth_profiles.sql`: registration trigger creates only a personal profile; own-profile read/update policies and column-limited updates; guarded Users RPC joins canonical Auth data to profiles. Editable metadata never grants roles.
4. `backend/user-management.sql` → `20261027000200_waylo_user_management.sql`: all mutation RPCs require admin; profile edits use concurrency versions and audit; invitations are rate-limited and audited; no administrator grants or Auth/password changes are made by the SQL.

No source or prepared migration was modified or executed. Source review and anonymous API denial do not prove the complete installed policy/grant definitions or signed-in account isolation. Those remain outside this audit. Review follows [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [function privilege/search-path guidance](https://supabase.com/docs/guides/database/functions).

## Exact assistant URL fix

The current diagnostic is `EXPO_PUBLIC_ASSISTANT_URL is missing`: the app value is blank. Public Supabase configuration is present and the app/backend use matching project/public-key configuration. This URL problem is separate from account registration.

1. Provide a real public HTTPS host for the existing service on port 8787, or a separately authorized HTTPS development tunnel to it. No public endpoint or tunnel was created/verified here.
2. In root `.env.local`, set `EXPO_PUBLIC_ASSISTANT_URL` to that **actual HTTPS origin/path ending exactly in `/packing-chat`**. For example, replace the placeholder in `https://<your-backend-host>/packing-chat`; do not enter the placeholder literally. Do not put a key, query or fragment in the URL.
3. If using the browser app, add its exact origin (for example `http://127.0.0.1:8081`) to the server's `ALLOWED_ORIGINS`, retaining any other intentional origins. Native requests do not require a browser Origin. Restart the backend after server env changes.
4. Restart Metro with `npm.cmd run start:go -- --clear --port 8081`, then run `npm.cmd run backend:check -- --network --report` to check public readiness without calling AI.

`http://127.0.0.1:8787`, a LAN HTTP address or an Expo Metro tunnel is not the required public AI URL. Localhost on a phone means the phone. Metro exposes the JavaScript bundle, not this separate service. Do not change only the boolean or disable HTTPS validation.

## Local servers and remaining blockers

Started and left running for review:

```powershell
Set-Location 'D:\vi\MyApp'
# Use separate terminals if starting again; do not start a duplicate on an occupied port.
npm.cmd run admin:start
npm.cmd run backend:start
```

Admin: [http://127.0.0.1:8788](http://127.0.0.1:8788). Assistant: [health](http://127.0.0.1:8787/health), [ready](http://127.0.0.1:8787/ready). Admin readiness explicitly reports `databaseVerified:false` until actual authenticated checks; 200 is configuration readiness only.

Authenticated registration/OTP/login, signed-in ordinary-user denial, real admin profile visibility/editing and trip/packing persistence stay **BLOCKED / NOT TESTED**. The owner reported no private test credentials and explicitly excluded authenticated testing. SMTP/template settings and delivery were not inspected; local files cannot verify them. Admin invitations additionally lack `ADMIN_SUPABASE_SECRET_KEY` in the server-only environment. Never add that secret to Expo or public assets.

Next steps are to supply the real assistant HTTPS endpoint and, only when separately authorized and credentials are available, complete the real two-account admin/profile acceptance and disposable-account cloud acceptance. No regular/demo user was granted administrator access, and no existing grant was changed.
