# Waylo implementation and acceptance status

Updated 27 October 2026. This report separates new implementation, controlled tests, current live read-only checks and work still blocked by access/configuration. It does not claim all requested acceptance is complete.

## Implemented in this project

- Premium mobile Login/Register now defaults to real Supabase password authentication. An email-confirmed password login goes directly to Home. Register uses email/password and optional name, then verification when required. No role or confirmation override is sent. Passwordless accounts retain the email-code option. Forgot password, show/hide, keyboard Next, input validation, loading locks and existing recovery routes are connected.
- Real email-code verification and the absolute resend deadline remain. Failed rate-limited sends get a cooldown and useful guidance without pretending an email was sent. Provider limits are not bypassed. Encrypted native session storage and explicit cloud publication are unchanged. Local trips, packing, bookmarks and preferences are not reset by auth changes.
- The existing admin panel gains a development-only data-source switch. Twelve realistic fictional users are seeded into ignored `admin/.demo/users.json`, using only `example.test` addresses. Demo profile edits persist locally, concurrent stale edits fail, search/empty states work through the same panel, and demo invitations are explicitly simulated. No demo Auth identities, trips, emails or administrator grants are added to Supabase. Live and demo results never merge.
- Real Supabase administrator login, current database allowlist checks on every protected request, CSRF, Origin, confirmation rules, session expiry and server-only invitation keys still apply. Demo routes require the same real administrator checks. Production, public binds and non-loopback origins cannot enable demo data. A banner plus row badges identify demo records; new logins begin in live mode.
- `admin:check` reports configuration and staged migration equality without printing credentials. `--network` reads real Auth settings; it does not install SQL, send email, authenticate test users or infer SMTP setup. `--report` writes sanitized evidence.

## Actual checks completed

| Check | Result and boundary |
| --- | --- |
| Full suite | 169 passed. Includes password-session decisions, confirmation handling, registration metadata, secure-storage/local-trip regressions, admin denial/revocation, CSRF, invitation failures, profile version conflicts, demo isolation/search/persistence and no real-email simulation |
| Provider adapters in tests | Controlled test doubles; these are not successful live registrations, login sessions, invitations or delivered emails |
| TypeScript and Expo lint | Passed after correcting the SDK 58 text-input instance ref type |
| Admin production asset build | Passed: seven assets, JavaScript syntax checked, CSS compiled with zero warnings; no env files or server code included |
| Expo production export | Android and iOS Hermes bundles plus web bundles and 36 static routes exported to ignored `dist-native-final`. This is not a signed APK/IPA or an EAS release |
| Current live Supabase settings | Real HTTPS read passed: email provider enabled, signup enabled, email auto-confirm disabled. Existing selected project/public configuration is valid |
| Running local admin | `/health` and `/ready` 200; assets 200; anonymous Users/Trips requests 401. Readiness reports configuration, not a completed database/admin check |
| Demo seed | Twelve records created locally and Git-ignored. No cloud accounts or mail created. Real admin browser interaction remains untested |
| Migration copies | All four staged migrations match their canonical SQL. This does not prove deployment of the pending fourth migration |
| Browser/mobile interaction | Not completed: both browser and Windows fallback tools fail to initialize with `failed to write kernel assets ... os error 3`. No new screenshot or rendered layout acceptance is claimed |
| Live auth/admin acceptance command | Refused to run because disposable admin/ordinary-account test credentials are absent. No services were called by that command |

An initial export overlapped creation of the new password module and failed resolution. A fresh complete all-platform export then passed. Historical signup -> email confirmation -> login -> explicit trip/packing publication -> admin visibility evidence remains in `verification/supabase-flow.json`; it is not acceptance of this changed login UI or new email-code templates.

## Still blocked / manual setup

1. **Pending SQL:** `backend/user-management.sql` / `supabase/migrations/20261027000200_waylo_user_management.sql` has not been executed by this work. It adds guarded profile editing and invitation audit/rate-limit RPCs, preserving data and admin grants. Database/management credentials are unavailable and the signed-in browser tool cannot initialize. Live profile editing is not claimed.
2. **Email templates:** apply `backend/email-templates/login-otp.html` to Authentication -> Emails -> Magic Link/OTP, and `signup-otp.html` to Confirm sign up. Keep the real `{{ .Token }}` variable. Template installation and received numeric codes remain unverified.
3. **SMTP:** a sender domain and SMTP provider credentials have not been supplied. Configure a verified sender and provider host/port/username/password in Supabase's trusted SMTP settings. Disable email tracking/link rewriting for auth emails where supported. Keep confirmation and rate limits enabled. Check provider logs and Supabase Auth logs using the timestamp of one controlled request. Do not guess SMTP values or raise limits to conceal delivery failures. The earlier request hit `over_email_send_rate_limit`; no new email requests were sent in this work, so the current quota/receipt status is unknown.
4. **Invitations:** `ADMIN_SUPABASE_SECRET_KEY` is still missing in server-only `admin/.env.local`. Enter the selected project's secret locally, never in chat, `EXPO_PUBLIC_*` or public assets. The exact app callback is prepared locally; verify its Supabase redirect allowlist before sending an invitation. Restart the Node server after changing env values. A provider-accepted request still does not prove delivery.
5. **Acceptance access:** use existing confirmed disposable admin and ordinary test accounts in ignored `admin/.env.test.local`, then run `admin:verify-live`. Browser/phone acceptance must additionally cover registration, receipt/expiry/resend, password login, logout, local trips surviving, explicit cloud save, admin visibility, ordinary-account denial, profile conflicts and one real invitation/recipient acceptance. Never use demo data as evidence for this flow.
6. **Release:** no public HTTPS hosting, signed mobile binary or physical phone test was completed. Native SecureStore, keyboards, back gestures and device-specific layouts remain separate checks.

**Agla step (Hinglish):** Supabase ke selected Waylo project mein SQL Editor kholiye. `backend/user-management.sql` ka poora SQL run karke sirf Success ya exact error batayein. Keys/password chat mein mat bhejiye. Uske baad email template aur SMTP ka agla step verify karna hai.

## Exact Windows PowerShell commands

```powershell
Set-Location 'D:\vi\MyApp'
npm.cmd run admin:check -- --network --report
# Missing invitation configuration is an incomplete result, not a live-delivery pass.
npm.cmd run admin:start
```

Admin: **http://127.0.0.1:8788** · health: **http://127.0.0.1:8788/health** · readiness: **http://127.0.0.1:8788/ready**.

For isolated demo records **inside the same panel**, stop only its existing terminal with Ctrl+C, then:

```powershell
npm.cmd run admin:start:demo
```

This preserves/seeds the local demo file, starts the same server/URL and still requires your real granted administrator login. Select View demo data after login. Never start two admin servers on port 8788. The current verification server was restarted with this option, so old browser sessions need a new sign-in. Ordinary `admin:start` disables the demo switch unless explicitly enabled in local env.

Mobile Metro, in another terminal if it is not already running:

```powershell
npm.cmd run start:go -- --port 8081 --max-workers 1
```

Verification commands:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run admin:build
.\node_modules\.bin\expo.cmd export --platform all --max-workers 1 --output-dir dist-native-final
npm.cmd run admin:verify-live
```

References: [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Expo CLI export](https://docs.expo.dev/more/expo-cli/).
