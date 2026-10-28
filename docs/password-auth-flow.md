# Current Waylo authentication flow

The subsequent [expired-link and registration-code repair](auth-repair.md) adds eye icons, resumable verification and bounded launch/auth loading. Its validation and configuration limits supersede the earlier check counts below.

Updated 28 October 2026. This replaces the earlier optional-name / passwordless-entry design in the existing Expo SDK 58 app. No packages, mobile data migrations or administrator grants were added.

## Screens and behavior

- Register: **Name, Email, Password, Confirm Password**. Name is required (2-100 characters), email is validated, and a new password must be at least eight characters, at most 72 UTF-8 bytes and match its confirmation exactly. Passwords are not trimmed. Validation runs before contacting Supabase. Only the trimmed full name is included in registration metadata; no role or confirmation override is submitted. Confirmation is never sent to Supabase or saved.
- Verification: real `auth.verifyOtp({ email, token, type: 'email' })`, numeric paste/autofill, busy locks, expired/incorrect-code errors, a 60-second absolute resend deadline and `auth.resend({ type: 'signup' })`. Resending never creates another account. Code values are not persisted. An unconfirmed account can resume verification from Login; a code is sent only when requested.
- Login: **Email + Password**, Show/Hide and Forgot Password. Confirmed password authentication opens Home directly, with no login OTP request or method chooser. A failed password never becomes a successful session. Existing accounts created without a password can use Forgot Password to establish one through a verified recovery flow.
- First launch: Splash -> Onboarding -> Login/Register -> Home, with email verification required for a new registration. A restored confirmed session opens Home after splash, even if the device onboarding flag is absent. Replay onboarding still works explicitly from Profile. Authentication loading is resolved before the entry screen decides whether to show onboarding.
- Session storage: the existing encrypted, chunked native SecureStore adapter, refresh handling, exact callback validation and logout behavior remain. Native credentials persist across app launches. Expo web retains its existing **tab-scoped sessionStorage** behavior: same-tab reload can restore a session, closing the tab does not promise a persistent web session. Native keychain behavior was not physically tested.
- Local trips, packing, saved destinations and preferences remain in the existing travel store. Logout does not clear them. Publishing remains an explicit action. Registration does not upload trips or grant admin access.

## Profiles and admin

The installed `waylo_auth_profile_created` database trigger writes `waylo_profiles` from the new Auth user's `full_name`. The existing guarded `waylo_admin_users` RPC joins profiles with canonical Auth email/confirmation details. Ordinary users can read/edit their own profile; administration still requires the protected `waylo_admins` allowlist and a server-verified admin session. Editable names/metadata do not authorize administration.

The selected project already has the profile and admin migrations installed. **No additional SQL is required for this form change.** For a different new environment, use the existing documented migrations; do not reset a database or rewrite deployed migration files.

## Current email configuration blocker

Real read-only checks confirm email authentication/registration enabled and email auto-confirm **disabled** in project `alwvprhnokdcfnweiard`. Both public app variables are configured:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The live Confirm sign up preview currently contains **a confirmation link, not a numeric OTP**. Its Source/Save controls are disabled with “Set up custom SMTP to edit templates.” The menu offers a paid-plan change or a send-email hook as alternatives; neither was provisioned or enabled. Existing confirmation links remain supported so the current service does not strand accounts, but a link is not reported as a tested OTP.

To enable the requested numeric email OTP:

1. In the selected project's [SMTP settings](https://supabase.com/dashboard/project/alwvprhnokdcfnweiard/auth/smtp), configure your verified sender/provider. Enter SMTP secrets in the trusted dashboard yourself, never in chat or the app.
2. In Authentication -> Emails -> **Confirm sign up**, use `backend/email-templates/signup-otp.html`, retaining the real `{{ .Token }}` placeholder. Only this signup template is required by the new entry flow; the old magic-link login template is not required for password login.
3. Keep Confirm email enabled, expiration and rate limits intact. Configure the existing app callback allowlist for password recovery / confirmation-link compatibility. Numeric code entry itself needs no email deep link.
4. Perform one registration with an email you control, enter the received OTP directly in the app, verify Home, then log out and password-login without OTP. Check the same account's name and confirmation/traveler status in admin.

No service-role key, assistant backend, OpenAI key or admin invitation secret is required for app signup/login/profile creation. The separately missing admin invitation secret is unrelated to this authentication flow. No SMTP values, verification codes or passwords were invented.

## Actual verification

170 tests, TypeScript and Expo lint passed. Tests exercise required name/matching confirmation before network calls, password authentication without OTP, confirmation-required handling, safe errors, entry routing with restored sessions, native secure-storage rotation/logout and local-trip regressions. Upstream responses in unit tests are controlled adapters, not real signup/email acceptance.

The new four-field screen was rendered at 390px, with no horizontal document overflow and 58px input heights. Hidden password input types, Show/Hide controls, required-name validation and Name -> Email keyboard Next were inspected. A web-specific Next/blur compatibility issue was corrected. Browser control for the original app tab then detached; later field-focus checks and a fresh complete registration still require the user handoff.

Final production Android/iOS Hermes bundles and web/36 static routes were exported successfully, including the last verification-email wording changes. The actual Expo Go Android manifest and its complete source bundle returned 200 with valid JavaScript, Confirm Password present and the removed email-code chooser absent. These are not signed APK/IPA builds or physical-phone acceptance. See [current checks](verification/password-auth-checks.json) and [Android bundle evidence](verification/password-auth-android.json).

The live Supabase signup template was inspected read-only. Admin reauthentication and the real Users table remain available, with existing profile names and ordinary-user/admin badges. Earlier real password login, logout and cloud publication evidence is retained separately in `verification/completion-live-20261028.json`; it is not proof of completion of this new four-field signup-to-OTP flow.

**Not completed:** new registration -> received numeric OTP -> Home, new-password recovery email delivery, native cold-launch persistence/keyboard/safe areas on a physical phone, and a fresh restored-session browser acceptance. The email template/SMTP setup and direct user entry of new credentials are the current prerequisites. No email sends or new Auth accounts were initiated by the agent during this form update.

## Windows commands

From `D:\vi\MyApp`, reuse existing running servers or start in separate PowerShell terminals:

```powershell
npm.cmd run start:go -- --port 8081 --max-workers 1
npm.cmd run admin:start
```

App: [Login](http://127.0.0.1:8081/login), [Register](http://127.0.0.1:8081/sign-up). Admin: [existing panel](http://127.0.0.1:8788). The Expo app/server is separate from the optional AI backend. A phone uses its actual Expo Go LAN/tunnel URL, not `127.0.0.1`.

Validation commands:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
.\node_modules\.bin\expo.cmd export --platform all --max-workers 1 --output-dir dist-native-auth
```

References: [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [email OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SDK 58](https://docs.expo.dev/versions/v58.0.0/).
