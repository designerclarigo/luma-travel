# Waylo administration

A separate responsive web workspace for the existing Supabase-backed mobile app. It uses the app's bundled editorial/sans fonts, warm ivory, forest and champagne colors. It has its own Node server and does not modify mobile routes or their access policies. No dependencies need to be installed for the admin server on Node 24.

## Latest completion checks — 27 October

The mobile app supports direct verified password login, password registration with email verification, and optional email-code access. The same admin panel now supports **isolated development demo users**, search, persistent demo profile edits and explicitly simulated invitations. No fake Auth users are created in Supabase. Start with `npm.cmd run admin:start:demo`; sign in with a real granted admin, then select **View demo data**. A persistent source banner and per-user Demo badges distinguish the data. Live and demo data never merge. Demo addresses use the reserved `example.test` domain; no email is sent. The demo switch is unavailable in production or on a non-loopback bind/origin. `admin:seed-demo` preserves existing demo edits.

169 tests, lint, TypeScript, admin build and Android/iOS/web production exports passed. A real read-only Auth settings check passed; confirmation remains required. Browser/physical-device acceptance, pending user-management SQL, numeric email-template installation, SMTP and the missing invitation server key remain unresolved. See [precise results and next setup step](../docs/completion-status.md). Prior sections below describe earlier phases and must not be read as fresh end-to-end acceptance.

## Premium workspace refresh

The current presentation update adds refined SaaS typography, a forest sidebar, responsive metric/user cards, clear search, profile editing before collapsible account details and a focused invitation panel. Existing authentication, server/database permissions and data APIs are preserved. Run **npm.cmd run admin:build** for the asset build; it stages seven public assets and a manifest in **admin/dist**, with no env files. The authenticated Node server is still required. See [visual refresh and actual validation](../docs/admin-redesign.md). 161 tests, lint, TypeScript and the asset build passed. Browser-rendered/interactive acceptance remains pending because browser control was unavailable.

## Current email-code and user-management update

The mobile entry supports Splash -> Onboarding -> Log in/Register -> email verification when needed -> Home. Users navigation supports profile editing and add-by-invitation. See [current setup and actual checks](../docs/auth-setup.md). The new guarded RPCs in **backend/user-management.sql** are prepared but were not applied because browser control became unavailable. Numeric-code email templates are prepared in **backend/email-templates/** and still need live application/verification. A prior real OTP request reached the project and hit its email rate limit; no successful OTP verification or new-flow registration/admin visibility is claimed.

Invitations additionally require **ADMIN_SUPABASE_SECRET_KEY** in the ignored server-only env file; it is currently absent. The local app callback is prepared. Public app configuration and existing reads remain connected. Admin tests use controlled upstream adapters; cloud permissions for the new RPCs and invitation delivery remain untested. The historical core integration evidence below does not establish completion of the new flow.

## Live integration progress — 27 October 2026

The user-selected existing Supabase project (`alwvprhnokdcfnweiard`) is configured in the ignored mobile, admin and assistant-server local env files using its **public publishable key**. No secret/service-role key was used. Both `backend/supabase.sql` and `backend/admin.sql` were executed successfully through that project's authenticated SQL editor. Read-back verified six Waylo tables with RLS enabled, 18 functions, the three mobile policies and room realtime publication. After the owner's explicit account-specific approval, the exact email-confirmed app account received admin access; read-back showed one active admin.

Real HTTPS checks confirmed email signup is enabled, email confirmation is required, and anonymous room/admin requests are denied with HTTP 401 / PostgreSQL `42501`. Before promotion, real PostgreSQL assertions ran as `authenticated` with transaction-local claims for the existing confirmed account: five admin read RPCs and direct private-admin-table reads were denied; self-promotion privilege was absent. These are live database-role assertions, **not** an ordinary-account password login through the web server. See [database evidence](../docs/verification/supabase-installed.json), [anonymous-access checks](../docs/verification/supabase-public-access.json), [normal-role checks](../docs/verification/supabase-normal-role.json) and the [acceptance steps](../docs/supabase-integration.md).

The local dashboard returned `/health` 200 and `/ready` 200 with `databaseVerified:false`; readiness still checks only server configuration. The owner completed actual app signup/email confirmation and sign-in. Through the app UI a clearly named test journey and itinerary were saved, packing was edited, then the trip was explicitly published. Real SQL read-back confirmed revision 1, the same dates/itinerary, 27 packing rows, 50 pieces and 2 packed, including one of two water bottles. Cloud-copy review showed matching 4% progress; the app session/cloud link survived same-tab reload. **Real admin password login then passed.** The dashboard displayed one verified user/admin, one shared trip, 27 packing rows and zero manual backups. Its exact trip detail matched the app's dates, two travelers, USD 1,200 estimated budget and itinerary; packing showed the same 2/50 units and partial bottle 1/2. Packing-item search and owner membership were verified. Users, Shared journeys and Packing lists navigation loaded real records. The test trip is retained for review. See [live flow evidence](../docs/verification/supabase-flow.json). Typecheck, lint and 13 controlled-response admin tests passed on 27 October. The older 26 October full-suite/UI results below are historical.

## Run in VS Code / Windows PowerShell

```powershell
Set-Location 'D:\vi\MyApp'
npm.cmd run admin:setup
npm.cmd run admin:start
```

Open **[http://127.0.0.1:8788](http://127.0.0.1:8788)**. Keep the terminal open; Ctrl+C stops it. Use that exact origin rather than `localhost` with the default configuration. This is separate from Metro (8081) and the AI assistant server (8787). Neither Expo nor OpenAI is required to run the dashboard.

`admin:setup` preserves existing env files. It creates ignored `admin/.env.local` and optional `admin/.env.test.local` templates and prepares the additive migration `supabase/migrations/20261026000200_waylo_admin.sql`. It does not contact a database or create accounts.

## Connect the existing Supabase project

The new native signup/login/recovery screens and private account profiles are documented in [account setup](../docs/auth-setup.md). Apply the additive **backend/auth-profiles.sql** migration after the original two schemas to install the registration profile trigger and updated guarded Users RPC. It backfills existing profiles without changing any administrator grants or published trips. It is now installed in the selected project: initial backfill and a subsequent fresh registration were read back, with three users/profiles and one active admin. The new verified ordinary account appears with its actual registered name in Users. An unconfigured environment reports a missing profile migration; no profile details are fabricated.

1. In `admin/.env.local`, set `ADMIN_SUPABASE_URL` and `ADMIN_SUPABASE_PUBLISHABLE_KEY` to the existing project's HTTPS URL and public publishable key. A legacy **anon** key also works. When blank, these fall back to the root mobile app's `EXPO_PUBLIC_SUPABASE_*` settings. Supabase secret/service-role keys are rejected. **No privileged Supabase key or OpenAI key is needed.**
2. In that project's trusted Supabase SQL editor, apply `backend/supabase.sql` if not already installed, then all of `backend/admin.sql`. Alternatively, use the corresponding prepared migrations in chronological order. Do not reset the database or modify a deployed migration.
3. Create/use an existing email-confirmed Supabase account. Copy its UUID from Authentication → Users. Grant that one account admin access through trusted SQL:

```sql
insert into public.waylo_admins(user_id)
values ('YOUR-CONFIRMED-USER-UUID')
on conflict (user_id) do update set active=true;
```

4. Restart `npm.cmd run admin:start`, open the dashboard and sign in. No public registration, client-side role selection or demo credentials are provided.

To revoke access, run this in the trusted SQL editor:

```sql
update public.waylo_admins set active=false where user_id='USER-UUID';
```

The next protected request is denied and its web session is removed. With the new migration and optional server secret configured, the dashboard can ask real Supabase Auth to create an ordinary invited account and send its email. It cannot choose passwords, force email confirmation or grant administrator access. No invitation delivery has been verified here.

## What the screens show

| Screen | Real source / behavior |
| --- | --- |
| Overview | Account totals/confirmed accounts/new signups from `auth.users`; shared-room, packing-row, membership and manual-backup counts; six months of signup counts; latest published trips and admin deletion audit |
| Travelers | Paginated full-name/email search; real profile name/home city (when the profile migration is installed); canonical email/confirmation/admin status, join/last-sign-in dates; owned rooms, memberships and backup availability. Missing names are labeled, never invented. No passwords, tokens, raw auth metadata or backup contents |
| Shared journeys | Paginated title search and status filters; dated route, itinerary, travelers, owner, members and estimated budget. Stored budgets remain USD; no made-up conversion or live pricing |
| Packing lists | Shared-room lists and detail with actual per-person/shared items, categories, quantities, partial packed counts, progress, item search and all/to-pack/packed filters |
| Connection settings | Configuration instructions and exact missing variable names; schema/grants are verified on sign-in, not inferred from env-file existence |

The current database has **no separate `trips` table**: published trips are stored in `waylo_rooms.document.trip`. Only explicitly shared/published snapshots appear. Local-only trips and unpublished mobile changes remain on devices. Packing lists are read-only in the admin UI to preserve the app's explicit publication flow. The dashboard does not automatically read private manual-backup documents.

## Admin enforcement and sessions

- `waylo_admins` and `waylo_admin_audit` have RLS and no direct anonymous/authenticated table privileges. Normal users cannot self-promote. Grants/revocations are performed only by a trusted database operator.
- Every exposed admin RPC calls `waylo_require_admin()` using `auth.uid()` and the current active grant. Security-definer functions use an empty search path and explicitly qualified tables. Existing mobile room/member/backup policies are unchanged. Browser/UI role flags and editable user metadata do not authorize anything.
- The server authenticates email/password with Supabase, verifies the identity, checks the database grant, then issues a random opaque **HttpOnly, SameSite=Strict** cookie. Supabase access/refresh tokens stay in server memory and never enter browser JS/localStorage/responses. Auth identity and admin membership are rechecked for protected requests. Token refresh is single-flight.
- Sessions expire after 30 minutes idle or 8 hours total. Logout removes the local session and attempts provider sign-out. Restarting the server requires signing in again. This implementation is for one server process; multiple instances need shared protected session/rate-limit storage.
- POST requests require the exact configured Origin and JSON. Authenticated POSTs also require a session CSRF token. Host validation, CSP, frame blocking, no-store responses and bounded request bodies are enabled. Sign-in attempts are limited per direct client address. Add proxy/edge limits for hosted use.
- The only destructive action is **deleting a shared cloud trip**, not deleting user accounts. A separate confirmation dialog requires typing `DELETE` and a 6–500 character reason. Both server and database validate these fields. The SQL locks the row, rejects a stale revision and records the deletion in the same transaction. Room memberships/invites cascade; downloaded mobile copies remain. There is no undo.

## Hosting

For this local setup no host was provisioned or deployed. Production `ADMIN_ORIGIN` must be HTTPS; the server refuses non-HTTPS non-loopback origins and uses Secure cookies/HSTS on HTTPS. Set `ADMIN_HOST=0.0.0.0` only for a deliberate hosted deployment behind a TLS reverse proxy. The proxy must preserve the configured public Host header and allow access only through the intended origin. Keep env files outside public/static paths. The server serves an explicit asset allowlist, not a directory listing.

## Checks and current configuration

```powershell
npm.cmd run admin:test
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

26 October validation: **138 tests passed**, including 13 targeted admin tests; typecheck and lint passed. Desktop and 390px/320px browser layouts were reviewed. See the [sanitized verification report](../docs/verification/admin-checks.json) and [actual setup-screen screenshot](../docs/verification/admin-dashboard-desktop.png). The local verification servers are stopped after QA; use `admin:start` above to run your own VS Code session.

- Targeted admin tests cover missing config, session enforcement, non-admin/revoked grants, missing migrations, CSRF/Origin/Host checks, confirmation validation, revision forwarding, pagination, refresh/logout/expiry, throttling, security headers and escaped/quantity-based UI models. Their upstream Supabase responses are controlled **test doubles**. SQL definition checks are structural and do not prove deployed RLS.
- The production dashboard was rendered locally with real missing-configuration state. Populated UI flows were reviewed only on an isolated, explicitly labeled fixture server—not against live Supabase. That fixture harness lives in ignored `.expo`, is not imported by production and is stopped after verification.
- At the earlier 26 October review, Supabase settings and migrations were unavailable. The 27 October progress above supersedes that status. The core local signup → app publication → authorized admin visibility flow is now verified against real Supabase. An ordinary-account **web password-login rejection**, native-phone/SecureStore acceptance, two-device collaboration and deletion/audit remain untested. The ordinary database-role denial test is separate and passed. Production SMTP/redirect acceptance and public HTTPS admin hosting are still outstanding. No public hosting was provisioned.

For real read-only acceptance after configuration, fill `admin/.env.test.local` with two existing confirmed test accounts: one granted admin, one normal user. Start the dashboard and run:

```powershell
npm.cmd run admin:verify-live
```

This checks anonymous/normal-account denial directly against the database, real admin read RPCs, server login/data access/logout. It performs no account creation, grant changes or destructive operations. Missing configuration exits with code 2 before any service calls. The sanitized result is `docs/verification/admin-live.json`. Live deletion/revision conflict/audit and revocation must also be accepted on a disposable room/account after deployment.

Useful local endpoints: `/health` reports the web process; `/ready` reports only valid configuration, with `databaseVerified:false`. A 200 readiness response does not prove an installed migration or admin access.

References: [Supabase database-function security](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [server-verified user identity](https://supabase.com/docs/reference/javascript/auth-getuser).
