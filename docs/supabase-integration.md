# Supabase integration acceptance

Updated 27 October 2026. This records actual progress, not a simulated end-to-end result.

## Configured and verified

- The user confirmed the existing project `alwvprhnokdcfnweiard` for Waylo mobile and admin.
- Matching project URL/public publishable key are configured in Git-ignored `.env.local`, `admin/.env.local` and `backend/.env.local`. No secret/service-role key is required for these flows.
- `backend/supabase.sql` and then `backend/admin.sql` were executed successfully in the real project's SQL editor. The prepared migration copies still match those files. SQL-editor execution does not register Supabase CLI migration history. Do not edit these deployed migration files for future changes.
- Read-back: six tables with RLS, three mobile policies, 18 functions, private admin/audit tables, no anonymous trip read/admin execution, room realtime enabled. At read-back there were zero shared rooms and zero active admin grants.
- Real public-key HTTPS requests: Auth settings 200; anonymous room read and admin status/overview/users/trips each 401 with PostgreSQL code `42501`.
- The owner used the actual app account screen to sign up and clicked the confirmation email themselves. The app's success message, the real Auth user record and its confirmed timestamp were checked. No password was used by the agent or saved into project files. A browser confirmation is not a native-phone sign-in test.
- Real app sign-in and **Check cloud connection** passed. A clearly labeled test journey was created/saved through the planner, with an itinerary and edited packing. **Create shared trip** published it to Supabase. SQL read-back matched the exact trip: revision 1, 3–6 November, two travelers, 27 rows, 50 pieces, 2 packed, including a partial bottle quantity of 1/2. Cloud-copy review showed cloud/device both 4% packed. App session and cloud link survived reload in the same browser tab.
- Before admin promotion, five admin read RPCs rejected the confirmed account in a real `authenticated` database-role test with transaction-local identity claims. The private admin table was unreadable and self-promotion INSERT privilege was absent. All role/claim context was rolled back. This was **not** a password sign-in through the admin web server.
- After explicit approval for the exact confirmed account, the account-specific grant was executed. Read-back confirmed exactly one active admin and the chosen account active.
- Actual admin password login passed through the production local server. Real overview counts were one user, one shared trip, 27 packing rows and zero backups. The admin Users page showed the chosen account verified/admin with one owned trip. Exact trip detail matched dates, two travelers, USD 1,200 estimated budget and itinerary. Packing detail matched 27 rows, 2/50 units, 4% progress and a bottle at 1/2; searching `water` displayed that partial row. Room membership showed the account as owner. Users, Shared journeys and Packing lists navigation loaded real records. These views used live protected Supabase RPCs, not a fixture server.
- The admin page was reloaded; its existing server session was verified again and the real packing-list record loaded successfully.
- Local admin process: `/health` 200; `/ready` 200, `databaseVerified:false`. The latter is configuration readiness, not an authenticated data check.
- Typecheck and lint passed. Thirteen targeted admin tests passed using controlled upstream responses; they do not establish live user/admin behavior.

Evidence: [schema metadata](verification/supabase-installed.json), [public API checks](verification/supabase-public-access.json), [normal-role assertions](verification/supabase-normal-role.json), [published-trip data](verification/supabase-published-trip.json), [approved grant](verification/supabase-admin-grant.json), [flow progress](verification/supabase-flow.json), [SQL success screenshot](verification/supabase-install-success.png).

## Completed account and publication flow

1. **Completed:** the owner signed up through [Waylo Cloud account](http://127.0.0.1:8081/account) and confirmed the email. Do not send passwords through chat or store them in project documentation.
2. **Completed:** the account was identified in Supabase **Authentication → Users**, its normal database role was tested, and the owner explicitly approved its exact grant. The grant was executed and read back. No automatic self-promotion exists.
3. **Completed:** the owner signed in to the app; actual cloud check, test-trip publication and packing read-back passed.
4. **Completed:** the owner signed in at [the admin dashboard](http://127.0.0.1:8788); authorized real-data views were compared with the same published trip. The app at 8081 and admin at 8788 have separate sessions. The AI server at 8787 is neither login screen. Passwords were entered only by the owner in the actual UI.

The clearly labeled `Waylo cloud verification · 27 Oct` test record is retained so the owner can inspect the result. No cloud records or accounts were deleted. Screenshots of the live admin views contain the account email and are kept in ignored `.expo/waylo-admin-live-*.png`; sanitized JSON evidence is in `docs/verification/`.

In the later account update, **backend/auth-profiles.sql** was installed and exact local/native development callbacks replaced the original `localhost:3000` fallback. Real read-back verified two profiles, one active admin, registration metadata backfill, RLS and a signup trigger. A real ordinary account's password login passed and authorized admin Users displayed its true registered name and Traveler status. Rollback-only database-role checks verified own-profile editing, other-profile isolation and admin Users denial. A later fresh signup after trigger installation created a third matching private profile; real Auth records show confirmation followed by a later sign-in, and admin Users displayed its accurate Testing name and verified Traveler status. Admin count remains one. One real recovery request hit the Supabase email rate limit, so password-reset/native-link acceptance remains outstanding. See [current account setup](auth-setup.md) and [profile permission evidence](verification/auth-profile-permissions.json).

Custom SMTP was disabled at inspection. Supabase's built-in mail service has strict recipient/rate restrictions. If signup reports an unauthorized email or delivery error, configure your own SMTP provider through Authentication → Emails → SMTP Settings; do not disable confirmation to bypass delivery. Production redirects need an owned reachable app website and stable native callbacks. No public website was deployed here. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

## Verification boundaries

- **Passed in Expo web:** signed-in cloud check, real test-trip/packing publication, SQL read-back, matching cloud-copy packing progress and same-tab page reload. Published content lives in `waylo_rooms.document.trip`, not a separate trips table. Local-only trips do not appear in admin.
- **Passed:** the approved account signed in to the real admin server and opened the same published room. Dates, itinerary, member role, packing rows, totals and partial quantities matched the app.
- **Partly verified:** anonymous HTTPS access and ordinary-role database admin access are blocked. A second confirmed ordinary account's real password login through the admin server and cross-account room isolation remain untested.
- Verify native-phone sign-in and local SecureStore/session persistence separately. Browser login and Metro bundling do not prove those native behaviors.

Existing optional live scripts require users to configure credentials locally in ignored test-env files. They never need a Supabase secret key. `admin:verify-live` performs real read/denial checks with two confirmed accounts. `backend:verify-live` uses four disposable accounts and creates/removes its own temporary test records; review its documented scope before running. Neither script's missing-credentials exit is a passing live test.

## Start on Windows PowerShell

First terminal:

```powershell
Set-Location 'D:\vi\MyApp'
npm.cmd run admin:start
```

Dashboard: [http://127.0.0.1:8788](http://127.0.0.1:8788). Process health: [http://127.0.0.1:8788/health](http://127.0.0.1:8788/health). Configuration readiness: [http://127.0.0.1:8788/ready](http://127.0.0.1:8788/ready).

Second terminal:

```powershell
Set-Location 'D:\vi\MyApp'
npm.cmd run start:go -- --port 8081 --max-workers 2
```

Computer browser account page: [http://127.0.0.1:8081/account](http://127.0.0.1:8081/account). Keep both terminals running. If already running, reuse them rather than starting duplicate listeners. Expo Go must use the current LAN QR/address printed by Metro; `127.0.0.1` on a phone points to that phone.

The AI service is separate on 8787. Its OpenAI credentials, model and public HTTPS hosting are still absent; none of the verification above claims AI works.
