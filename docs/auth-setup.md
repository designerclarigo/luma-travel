# Waylo: password and email-code access, user administration

Updated 27 October 2026. Code uses the existing Expo SDK 58 app and selected Supabase project alwvprhnokdcfnweiard. No mock OTP, automatic administrator grant or secret in mobile code is used. Optional, labeled admin demo records are isolated local development data, never Supabase identities. See [current completion and acceptance report](completion-status.md).

## Mobile flow

First launch: native/animated Splash -> Onboarding -> Log in/Register -> Home. New accounts must verify email before entering Home; email-code login also includes the code verification screen.
Returning users with a confirmed persisted session go to Home. Signed-out users go to Log in. Protected travel routes and tabs return to Login rather than offering an Explore bypass. Onboarding completion is written durably and updates the launch state before navigation. Replay remains available in Profile.

Login defaults to email/password through real Supabase signInWithPassword. Confirmed sessions proceed directly to Home; an unconfirmed account gets a clear email-verification message. Register defaults to email/password and optional name through signUp; an unverified signup proceeds to the existing code screen. New passwords require at least eight characters and at most 72 UTF-8 bytes. No repeated password field is needed. Forgot password, show/hide and keyboard Next-to-password are connected. No role is submitted in signup metadata.

Both forms also offer “Use an email code instead.” That option calls signInWithOtp; only Register sets shouldCreateUser=true. Verification calls verifyOtp with type=email. Password signup resends use auth.resend(type=signup). The input supports paste/autofill and provider code lengths of 6-10 digits; no code is embedded in the app. Resending uses an absolute 60-second deadline so background time is counted. A rate-limited request starts a local cooldown without claiming a code was sent. Supabase may enforce a longer project-wide limit. Loading locks, readable provider errors, code validation, change-email and Android verification-screen back handling are connected. A late request from an unmounted form cannot override the active form.

Successful verification opens Home directly; a deliberate shared-trip invitation can continue to the existing invitation review instead. Profile logout uses one confirmation sheet on Profile. Device trips, packing, saved places and preferences are retained. Cloud publication remains explicit: choose trip -> review cloud save -> Publish. No location/notification permission is requested by the authentication screens. Home's existing location lookup asks for permission only on the user's explicit detection action.

Native sessions use the existing encrypted, chunked SecureStore adapter and auto-refresh. Old sessions remain compatible. Expo web intentionally uses tab-scoped sessionStorage; it does not prove native keychain behavior. Existing password recovery URLs remain supported and Forgot password is linked from Login.

## Required live email setup

Both project email templates must include the provider variable {{ .Token }}:

1. Authentication -> Emails -> Magic Link/OTP: replace the email body with backend/email-templates/login-otp.html. Suggested subject: Your Waylo sign-in code.
2. Authentication -> Emails -> Confirm sign up: replace the body with backend/email-templates/signup-otp.html. Suggested subject: Confirm your Waylo email.

The files contain original ivory/forest Waylo email styling and the actual token placeholder. Keep email confirmation, rate limits and code expiry enabled. If a template still sends a sign-in link, the existing validated callback remains supported; that is not a passed numeric-OTP test.

The browser-control connection became unavailable during this work, so **these template edits were prepared but not applied or verified by the agent**. The user was asked to complete the first template change. The earlier development redirects remain documented below; their current state was not reread this turn.

A real SDK request for the existing confirmed Testing account reached the same project and returned over_email_send_rate_limit. No session was issued, no new user was created, and email receipt/code verification were not verified. See docs/verification/otp-request-live.json. Do not keep resending to bypass the limit. Custom SMTP was disabled at the previous inspection; production SMTP configuration and delivery acceptance remain required. Supply SMTP credentials in Supabase's trusted settings, never in chat or mobile environment variables.

## Admin users

The existing user list remains real and paginated, with full-name/email search, profile details, canonical email verification and immutable admin badges. Navigation now labels this section Users. Its Invite user action adds users by invitation; it does not assign a password or bypass email ownership verification.

Profile editing changes only full_name/home_city through a guarded database RPC, with an expected update timestamp to reject stale edits. Email, confirmation and administrator grants are not editable here. Profile changes and invitation outcomes appear in the existing audit activity view. Invitations are recorded as requested/accepted/failed/unknown; accepted means Supabase accepted the request, not that an email was delivered.

Apply the **new additive** backend/user-management.sql (identical to supabase/migrations/20261027000200_waylo_user_management.sql) after the already prepared core, admin and profile schemas. It installs three RPCs, each requiring the real database administrator allowlist. Ordinary users cannot edit another profile, prepare an admin invitation or finalize its audit. It preserves existing users, trips, RLS and admin grants. It inserts no Auth users and grants no administrator privileges. Profile edits and new invitation audit RPCs are not live until this migration is applied. The agent did not execute this new SQL because browser access was unavailable; it is not a claim of updated Supabase CLI migration history.

An invitation request is checked by the server's current Supabase identity, active database admin grant, Origin and CSRF token; the database then validates/rate-limits/audits it before the server calls the real Auth invite API. Only whitelisted email/name fields are accepted. Requests cannot supply an admin role, password, email_confirm or redirect. API/SMTP failures and uncertain outcomes are never returned as successful delivery. Secret keys never enter API responses or public assets.

## Configuration

The app/admin already contain matching public settings for alwvprhnokdcfnweiard in ignored local env files. There is no missing public app key. Invitations additionally require in admin/.env.local:

    ADMIN_SUPABASE_SECRET_KEY=<same-project server secret>
    ADMIN_INVITE_REDIRECT_URL=http://127.0.0.1:8081/auth/callback

The callback was prepared locally, preserving existing env values. The server secret remains **blank/missing**. A same-project legacy service-role key is supported through ADMIN_SUPABASE_SERVICE_ROLE_KEY instead. Use a trusted local editor; do not paste it into chat. Never copy it into EXPO_PUBLIC variables or admin/public. Read-only users/trips and profile editing use the administrator's session/public key and do not require this privileged key.

For production, use HTTPS admin hosting and a stable, approved application callback. The local invitation callback is for this computer's web app; a physical phone cannot reach the computer using 127.0.0.1. Configure an installed app callback or stable HTTPS destination before phone invitation acceptance. The earlier exact development allowlist was http://127.0.0.1:8081/auth/callback, http://localhost:8081/auth/callback, waylo://auth/callback and exp://192.168.29.243:8081/--/auth/callback. Main numeric OTP entry does not require opening a deep link.

## Run on Windows

From D:\vi\MyApp, in two PowerShell terminals:

    npm.cmd run start:go -- --port 8081 --max-workers 1
    npm.cmd run admin:start

App: http://127.0.0.1:8081/ ; Login: http://127.0.0.1:8081/login ; Admin: http://127.0.0.1:8788 . Use existing running servers instead of starting duplicate listeners. The admin server was restarted for this update, so its old in-memory sessions need a fresh sign-in. admin:setup preserves env files and prepares migration copies; it never applies SQL to a cloud project.

## Actual verification boundaries

The current report is docs/verification/email-otp-admin-checks.json. Tests cover routing decisions, input/code validation, resend deadlines, server sessions/admin denial, CSRF, extra privilege-field rejection, secret isolation, invitation failures/uncertainty and optimistic profile updates using controlled provider adapters. They do not establish deployed RLS, real invitation delivery or native device interaction. The real OTP request probe is separate and hit the project's rate limit.

Earlier real password-based signup/confirmation/login/profile/admin results remain in auth-checks.json, auth-fresh-account.json and supabase-flow.json. They are historical evidence, not acceptance of this new numeric-OTP entry flow. Fresh OTP registration -> code verification -> Home -> real admin visibility, new live profile-edit RPCs, admin invitation acceptance, physical-phone persistence/keyboards and the newly changed rendered layouts remain unverified until the pending cloud configuration and browser/device checks are available.

References: https://supabase.com/docs/guides/auth/auth-email-passwordless ; https://supabase.com/docs/guides/auth/auth-email-templates ; https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail ; https://docs.expo.dev/versions/v58.0.0/sdk/securestore/

Navigation correction during QA: Metro reported an update-depth loop while nested route guards redirected during hot reload. Authentication now uses the supported central Stack.Protected groups and an idempotent EntryRedirect. All travel routes are covered by a route-inventory regression check; the Account auth bridge preserves existing invitation review. Typecheck, lint and 161 tests passed, and the final Android bundle returned HTTP 200 with valid JavaScript. A fresh rendered navigation acceptance remains pending because the browser-control runtime could not initialize.
