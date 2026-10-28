# Registration OTP and expired-link recovery

Temporary development access is now available through [Try local demo](local-demo.md), requested by the owner while email setup is pending. It uses separate local data and never creates a Supabase user or bypasses production authentication. The real email setup below remains pending.

Updated 28 October 2026. The mobile app uses real Supabase Auth. Numeric email delivery is **not verified**: no SMTP credentials or Management API access were supplied, and browser control failed during this repair. No email, account or administrator grant was created by this work.

## Changes

- Registration remains Name, Email, Password, Confirm Password. Supabase `signUp` receives only email/password and trimmed `full_name` metadata. Password login uses `signInWithPassword`, with no passwordless sign-in request. An unconfirmed account resumes its initial email verification.
- Registration verification uses `verifyOtp({ email, token, type: 'email' })`. Resend uses `auth.resend({ type: 'signup' })`, never another signup or a login magic link. Numeric paste, OS autofill, an absolute 60-second resend timer, incorrect/expired/used-code messages and change-email navigation are supported. `/verify-email` can accept the registered email and code after a page reload without automatically sending an email.
- Password, confirmation and recovery password fields have labeled eye/eye-off buttons with comfortable touch targets and announced pressed state. Confirmation is never transmitted or persisted.
- The public callback no longer waits for travel storage, fonts or onboarding photographs. Error parameters are parsed safely and credentials are removed from browser history before any auth request. An expired link leads to actionable Login / Verify email / Password recovery controls; an error is never treated as a successful session.
- Launch preparation and animation completion have bounded fallbacks. Auth restoration, profile loading, callback processing, password access, resend, recovery and logout cannot leave their UI waiting indefinitely. Auth transport is aborted after 15 seconds, including stalled response bodies; late transport replies are discarded. Longer SDK-operation deadlines handle initialization/lock failures separately.
- Auth routes remain reachable while the onboarding flag loads. The signup/login screen still enforces completed onboarding after the actual flag is read. Confirmed returning sessions retain their existing Home routing. Recovery retains its verified, time-limited recovery-session guard.
- Encrypted native session storage, web tab-scoped session storage, local trips, explicit cloud publishing, the profile trigger and database administrator checks are preserved. No travel-data schema or permission migration was changed.

The development server also logged a stale Metro SSR `unknown module` error. A cache-cleared restart and current HTTP/bundle checks are recorded separately; a restart alone is not evidence of working email authentication.

## Supabase setup still required — simple steps

The owner requested an easier setup and confirmed they do not own a domain. A small-scale testing option is Gmail SMTP **if Google App Passwords are available** on their account. The owner must enable 2-Step Verification if needed and create/enter the app password themselves. Begin at [Google App Passwords](https://myaccount.google.com/apppasswords); never request or store that credential in chat or app env files. Google account restrictions may hide this option. No Gmail SMTP connection has been configured or tested here.

After the owner confirms that option is available, enter settings directly in Supabase's SMTP form: host `smtp.gmail.com`, SSL port `465`, username and sender address = the same full Gmail address, sender name `Waylo`, password = the Google-generated **App Password**, not the normal Gmail password. Keep email confirmation and existing resend/rate limits enabled. Then apply the signup template below and test one actual new registration. Gmail delivery limits apply; production delivery needs a separately verified provider decision. See [Google App Password requirements](https://support.google.com/mail/answer/185833?hl=en), [Google SMTP transport](https://developers.google.com/workspace/gmail/imap/imap-smtp) and [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

For a future verified domain, [Resend's guided Supabase integration](https://supabase.com/partners/catalog/resend) can fill SMTP settings automatically. [Resend requires an owned verified domain](https://resend.com/docs/dashboard/domains/introduction); no Resend account/integration or domain was created here.

The current public settings check confirmed email/signup enabled and **email auto-confirm disabled**. The latest earlier dashboard inspection showed a link-only Confirm sign up template, with editing locked until custom SMTP (or another supported delivery setup). That template state could not be rechecked during this repair because browser automation became unavailable. The screenshot supplied with this issue is a **sign-in-link** email; it does not prove that a registration numeric-code template is installed.

1. Apna selected project kholein: [Supabase SMTP settings](https://supabase.com/dashboard/project/alwvprhnokdcfnweiard/auth/smtp). Apne email provider ka verified sender aur SMTP settings yahin enter karein. Password/API secret chat ya mobile env mein na daalein. No provider or paid plan was purchased or enabled.
2. Authentication → Emails → Templates → **Confirm sign up** → Source. Subject rakhein **Your Waylo verification code**. [signup-otp.html](../backend/email-templates/signup-otp.html) ka complete HTML paste karke Save karein. Isme `{{ .Token }}` numeric code hai; `{{ .ConfirmationURL }}` link nahi hai. Agar Save disabled ho, email delivery setup pehle complete karna hoga.
3. **Confirm email ON rakhein.** Numeric OTP ke liye Magic Link template ya `signInWithOtp` login add karne ki zaroorat nahi. Forgot Password abhi verified recovery links use karta hai; its callback allowlist must remain configured. Keep the server's expiry and rate limits; do not disable them to work around email failures.
4. Ek controlled email se Register karein. **Naya** received code app mein enter karein, purana email link nahi. Home khulne ke baad Logout → Email/Password Login karein; second OTP nahi aana chahiye. Password/OTP khud enter karein, chat mein nahi.
5. Authorized admin se [Users](http://127.0.0.1:8788/#users) kholein. Wahi registered name/email aur canonical confirmation status check karein. Naya user Traveler hona chahiye. Ordinary account ko admin login/RPC access nahi milna chahiye. Apna existing local trip open karke explicit cloud save karein and check its actual packing list in admin.

The already prepared `backend/auth-profiles.sql` installs the Auth profile trigger and guarded Users join. Earlier installation/live user visibility is documented separately. This repair does not require new SQL. The missing server-only invitation key affects administrator invitations, **not** mobile signup/login or profile creation.

## Validation boundaries

See `verification/auth-repair-checks.json` and `verification/auth-repair-android.json` for actual checks from this repair. Unit tests use controlled transport/provider adapters; they do not prove email delivery. A production export is not an installed native build. Current browser interaction, received numeric OTP, a fresh complete registration-to-admin run, native keychain behavior and physical-phone interaction remain untested until the listed setup and acceptance steps are completed.

Completed: **178 tests**, TypeScript, Expo lint, admin asset build, final Android/iOS Hermes and web/36-route production exports. After clearing the stale development-server cache, the current complete Android source bundle returned HTTP 200 and passed JavaScript syntax checks. `/login`, `/verify-email` and `/auth/callback` each returned HTTP 200 without the previous unknown-module error. Cold compilation initially exceeded the HTTP checks' deadlines; warm sequential requests passed. Concurrent cold SSR checks emitted development multiple-renderer warnings; HTTP success does not prove hydrated browser interaction. No new UI screenshot or phone acceptance is claimed.

```powershell
Set-Location D:\vi\MyApp
npm.cmd run start:go -- --clear --port 8081 --max-workers 1
# App: http://127.0.0.1:8081/login
# Resume registration verification: http://127.0.0.1:8081/verify-email
# Admin (separate terminal): npm.cmd run admin:start
# Admin: http://127.0.0.1:8788
```

References: [Supabase numeric template and link-prefetch guidance](https://supabase.com/docs/guides/auth/auth-email-templates), [registration verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/).
