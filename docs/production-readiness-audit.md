# Waylo production-readiness audit — 28 October 2026

**Verdict: NOT production-ready. The platform is not fully complete.**

The local travel/packing product and much of the admin/backend implementation exist and pass their automated regression checks. Fresh exports succeed, but dependency checks have failures, nearby discovery fails against its public provider, and critical authenticated and native acceptance has not been performed. The assistant is not connected to a public endpoint. No percentage-complete estimate would be supported by this evidence.

This is a source/configuration, automated-test, export and anonymous/public-service audit of the current working tree, not a penetration-test certification or store acceptance. Historical screenshots, account grants and successful flows in older documents were not counted as current live acceptance.

No migration, SQL permission probe, account creation, authenticated live test, email, invitation, AI request, grant change, cloud write, deployment or signing operation was performed. Existing application data and code were preserved. The only new executable is the repeatable read-only public-provider diagnostic in `scripts/audit-public-providers.cjs`.

## Current command evidence

| Command / check | Actual result |
| --- | --- |
| `npm.cmd test` | **200 passed**, 0 failed |
| `npm.cmd run backend:test` | **25 passed**, 0 failed |
| `npm.cmd run admin:test` | **26 passed**, 0 failed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed, including after adding the audit helper |
| `npm.cmd run admin:build` | Passed: 7 assets, JavaScript syntax valid, zero CSS warnings |
| `npm.cmd ls --depth=0` | Passed: installed direct dependency tree resolves |
| `npx.cmd --yes expo-doctor` | **19/20 checks passed; failed SDK patch-version check**, six packages |
| `npm.cmd audit --omit=dev --json` | Failed: **9 affected package entries**: 4 high, 5 low |
| `npm.cmd audit --json` | Failed: **11 affected package entries**: 4 high, 2 moderate, 5 low |
| `expo.cmd export --platform all --max-workers 1 --output-dir dist-native-production-audit` | Passed: Android/iOS Hermes bundles and web assets, **36 static web routes** plus fallback HTML |
| `npm.cmd run verify:public` | Passed: **8 public/security groups**, including real anonymous Supabase denial |
| `node scripts/audit-public-providers.cjs` | **7 passed, 1 failed**: nearby discovery returned **HTTP 406**, twice |
| `backend:check -- --report` | Incomplete: `EXPO_PUBLIC_ASSISTANT_URL` is blank |
| `admin:check -- --report` | Incomplete: missing server-only invitation key |
| `backend:verify-live` / `admin:verify-live`, without opt-in | Fresh **BLOCKED** reports; no service calls |
| Known configured server-secret scan | No matches in **452 source/config/report/generated-artifact files**; private env/demo files are Git-ignored and not tracked |
| Browser / physical-device interaction | Not performed. Browser runtime initialization failed with `failed to write kernel assets ... os error 3`; no fresh rendered layout or device acceptance is claimed |
| Docker / SQL / signed app builds | Not performed. Docker/PostgreSQL/Supabase/ADB CLIs were not found on PATH; no EAS/signing login was attempted |

The 200-test suite includes the backend and admin tests; counts overlap. Backend/admin authentication tests use controlled upstream adapters. They prove application behavior under those inputs, not current real authentication, email delivery, RLS installation or model access. Public API checks use real HTTP and production parsers, not mock results. Restricted-network failures were retried with authorized network access; final public results are recorded separately from the initial sandbox failures.

Evidence: [command summary](verification/platform-audit-current.json), [build/config/migration/dependency/secret scan](verification/platform-static-audit.json), [real public providers](verification/platform-public-providers.json), [anonymous security checks](verification/public-security-current.json), [backend configuration](verification/backend-setup.json), [admin configuration](verification/admin-setup-current.json), [blocked backend acceptance](verification/backend-live.json), [blocked admin acceptance](verification/admin-live.json).

## Feature coverage and remaining acceptance

“Implemented/tested” below means source plus applicable production-model/adapter tests. It does not mean every control was tapped on a physical phone.

| Area | Present and supported by evidence | Remaining / current status |
| --- | --- | --- |
| Native splash / onboarding | Brand assets, fonts/photos preload, three native pages, swipes/Next/Back/Skip, durable completion, replay, reduced-motion branches, small-layout helpers | Compiles; actual release splash, phone gestures, screen reader, large fonts and performance **not accepted** |
| Home / Saved / details | Real saved-state greeting/statistics, next-trip countdown, packing progress, continue-planning links, filters, bookmarks, destination galleries and experiences | Local model tests pass; curated destinations, ratings and USD prices remain explicitly sample inspiration; no live booking product |
| Worldwide city/country lookup | Debounce/cancel/error states, unique IDs, regions/countries/coordinates; live Mumbai, Lahore, New York and India queries passed | Phone transport, native selection/keyboard and rate-limit UX not freshly exercised |
| Same-name locations | Live Springfield returned 12 distinct IDs with regions | Production parser and request passed; visual disambiguation still needs phone acceptance |
| Current city | Explicit location request, permission/error/manual fallback, native reverse-geocoder adapter | Real GPS/permission/reverse-geocoding behavior **not tested on device** |
| Planning / My Trips / trip details | Dates, travelers, budgets, interests, activities, create/edit/delete, compact status cards and persisted local state | Pure-model/persistence tests pass; complete UI flow still needs device testing |
| Route timeline | Numbered stops, nights/dates, reorder, collapsible editing and conflict diagnostics | Calculation/reordering/persistence tests pass; swipe/keyboard/accessibility acceptance pending |
| Weather summaries | Real Open-Meteo daily/hourly data, rain/conditions, timestamps, cache, unknown/seasonal disclosure | Live **16-day** forecast passed; seasonal offline coverage is limited to the bundled verified places; commercial service setup remains |
| Personalized packing | Explainable deterministic rules, duration/quantities, laundry/luggage, weather/itinerary inputs, family owners, age/diaper needs, cruise/formal-night inputs | Rule/preservation tests pass. These rules are **not AI**, and cruise operator schedules are not fetched |
| Packing editing / progress | Editable categories/items, quantities, notes, essentials, bag ownership, partial packed counts, rebuild preserving edits | Model and persistence tests pass; full device gestures/keyboard acceptance pending |
| Reusable templates | Create/edit/reuse/merge/past-trip lists | Model tests pass; UI acceptance pending |
| Bags / airline fit | Rotated dimension comparison, measured weight, manual ticket limits, honest unknown results, six dated fare presets | Math tests pass. Presets say checked **23 Oct 2026**; airline/fare/route accuracy was not reverified here. No live airline entitlement integration |
| Passport / globe / visited countries | Offline globe/reference list, manual visited/wishlist entries, trip completion, reversible visit records | Model tests pass; globe rendering/performance on devices not verified |
| Unused-item learning | Reversible post-trip feedback, repeated-trip evidence, essential-item protection | Model tests pass; no server-side learning or AI claim |
| Currency | Country mappings, locale formatting, manual override, canonical USD storage, real rates with stale/unavailable handling | Fresh INR/PKR/USD rates and numeric conversion passed; conversion is an indicative estimate, not a bank/booking rate |
| Discovery / maps | Nearby filters, saved results, itinerary links, native/external map paths, attribution | **FAILING integration:** production Overpass adapter received HTTP 406 twice. Native Android release Maps key is absent; external maps are the intended fallback |
| Sharing / file backup | Summary share/copy, portable validated JSON, non-destructive import/merge, .ics export | Model/import tests pass. OS share sheet/document picker/calendar-file opening not tested on hardware |
| Offline storage | Local trip/bookmark/preferences persistence, migrations, failed-write protection, corrupt-read retry, cached external data | Tested at model/storage-adapter level. Travel collection is **unencrypted and device-scoped**, not separated for different real accounts |
| Multilingual UI | English plus Spanish/Hindi dictionary, **356** copy entries, units/language preference | **Partial:** new auth copy such as “Confirm password”, “Forgot password?” and resend messages falls back to English; not a complete localization |
| Notifications | Local inbox, read/unread/history preferences; native scheduled packing reminders | No remote push backend/APNs/FCM integration. Actual scheduled delivery and tap handling on devices unverified |
| Registration / verification | Name/email/password/confirmation, numeric signup OTP, resend countdown, paste/autofill props, email-change path, sanitized bounded errors | Source/adapters pass. **Real signup → delivered numeric OTP → verify → admin visibility remains BLOCKED** |
| Login / recovery / logout | Password-only login; email OTP is not requested on every password login; eye icons; recovery/callback handling; returning-session routing | Real credentials, email recovery, session revocation and cold native restoration **not live tested** |
| Sessions / personal profiles | Native chunked SecureStore adapter, registered-profile SQL trigger, own-profile RLS, canonical account fields joined into admin Users | Secure-storage adapter tests pass; real keychain/Keystore/session refresh/profile visibility not accepted. Web uses tab-scoped `sessionStorage`, not persistent sign-in after closing the browser |
| Supabase migrations / permissions | Four source migrations exactly match prepared copies; source uses RLS, restricted grants, empty security-definer search paths and current DB admin checks | No SQL applied. Exact installed migrations, signup trigger, policy catalog and authenticated account isolation **not verified now** |
| Shared-trip sync | Explicit create/publish/join/review/accept, viewer/editor roles, hashed expiring codes, revisions, realtime newer-version notice, offline downloaded copies | **BLOCKED live acceptance:** two-device edits, stale writers, expiry/revocation, reconnect and RLS isolation. It is explicit snapshot publication, not automatic merging |
| Account cloud backup | Manual one-backup-per-account upload/restore/delete, owner RLS | **BLOCKED live acceptance. Automatic background cloud backup is not implemented** |
| AI assistant | Real server-side Responses proxy, Supabase token verification, strict validated suggestions, consent/review/apply, per-user limits, cancellation/refusal handling | **BLOCKED:** blank public assistant URL; local readiness only checks configuration. No real model/auth/billing/request accepted in this audit |
| Admin overview / users / trips / packing | Responsive UI, totals, pagination/search, canonical user/profile fields, profile concurrency/audit, trip/packing details, confirmed cloud-trip deletion | Asset build and controlled API/model tests pass. Real admin login, search/edit/display, ordinary password-login denial and deletion/audit **BLOCKED** |
| Admin invitations | Admin-guarded prepare/audit → server-only invite API → outcome; no role/password/force-confirm inputs | **Unavailable:** `ADMIN_SUPABASE_SECRET_KEY` missing; SMTP and invitation delivery not inspected/tested |
| Demo isolation | 13 labelled local demo records, all `is_admin:false`; release demo access rejected; server requires real admin before demo browsing | No demo Auth users created and no role grants changed. Demo cannot establish real live acceptance |
| Profile privacy / support | Editable profile/preferences, privacy disclosures, local FAQ | **Missing:** account/data-deletion flow, published policy/support contact and release data disclosures |
| Calendar / iOS widgets / Live Activities | SDK APIs and CNG plugin wiring, authoritative saved-state snapshots, Expo Go runtime guards | Compiles only. Needs signed native builds, widget App Group signing, OS forms/permissions and physical-device validation |
| Other platform scope | Graceful unavailable/fallback behavior is explicit | Android widgets, Siri/App Intents, remote push, billing/purchases and live bookings are **not implemented**. Decide launch scope; do not advertise them as working |
| Deployment / operations | Assistant Dockerfile, unprivileged container user, health checks, server HTTPS/Origin/CSP/CSRF/session controls and setup docs | No production host/TLS deployment verified, EAS project/build profiles/CI absent, signing unknown, monitoring/restore/load/rollback acceptance missing |

## Release-blocking findings and exact next steps

### 1. Finish and accept real authentication before inviting users

Configure Supabase email delivery and the actual **Confirm signup** template using `backend/email-templates/signup-otp.html` (`{{ .Token }}`), retain email confirmation, and set approved development/production callback URLs for recovery/invitations. Password login should remain password-only. Local template files do not prove dashboard activation or delivery; current public Auth settings only establish email enabled, signup enabled and auto-confirm disabled.

With **separate permission** and disposable test accounts, accept registration → inbox numeric OTP → invalid/expired/resend/change-email cases → verification → password login → restart/session restoration → logout/recovery → matching canonical user/profile in admin. Test a confirmed ordinary user's denial through both the actual web login and database calls. The present audit deliberately did not perform those steps.

For invitations, the owner must privately configure the correct project key as `ADMIN_SUPABASE_SECRET_KEY` **only on the admin server**, plus the approved callback and SMTP. Never place this secret or an OpenAI key in Expo/public assets. Confirm invitation delivery and ensure the new user remains ordinary.

### 2. Connect and operate the real assistant

`EXPO_PUBLIC_ASSISTANT_URL` is currently blank. Deploy the existing assistant as a separate HTTPS service, or use a separately approved development HTTPS tunnel, then set the app value to the real full HTTPS `/packing-chat` URL. A Supabase URL, local `http://127.0.0.1:8787`, LAN HTTP address or Metro tunnel is not this service.

Neither `http://127.0.0.1:8081` nor `http://localhost:8081` is presently in the server's web allowlist. If using browser preview, add the exact chosen origin to `ALLOWED_ORIGINS`, preserving other intentional origins; use the real deployed web origin in production. Restart backend and Metro after env changes. Native requests do not require a browser Origin.

Then check public readiness. Only with separate approval perform a real, potentially billable authenticated request and validate refusal/errors, the suggestion schema and explicit review/apply. Local `/health` and `/ready` both returned 200 here; that does **not** prove upstream credentials/model access or public phone reachability.

### 3. Resolve failing discovery and commercial provider readiness

The actual `src/lib/discovery.ts` → `nearbyPlaces` adapter returned **HTTP 406** twice from the Overpass service. Treat the cause as unresolved; this audit does not prove a permanent worldwide outage or a particular server-side cause. Review the provider's request/usage requirements and choose a reliable permitted endpoint/service with bounded retry, cache, quotas and clear errors. Re-run the supplied diagnostic and then device/UI acceptance. Do not replace the failure with fabricated POIs.

Weather/geocoding use hardcoded public Open-Meteo endpoints. Their free hosted service permits noncommercial usage; commercial release needs an appropriate agreement/service configuration and secure handling of any private provider key, rather than adding that key to a public app. See [Open-Meteo terms](https://open-meteo.com/en/terms). Review Overpass operational capacity and attribution, and preserve [ExchangeRate-API attribution/caching requirements](https://www.exchangerate-api.com/docs/free).

### 4. Resolve dependencies in the supported SDK line

Expo Doctor reports these exact patch mismatches:

| Package | Installed | Expected |
| --- | --- | --- |
| `expo` | `58.0.19` | `~58.0.20` |
| `@expo/ui` | `58.0.23` | `~58.0.24` |
| `expo-file-system` | `58.0.11` | `~58.0.12` |
| `expo-router` | `58.0.26` | `~58.0.27` |
| `expo-web-browser` | `58.0.6` | `~58.0.7` |
| `expo-widgets` | `58.0.23` | `~58.0.24` |

The full npm scan reports 11 affected package entries; these are not 11 independent proven runtime exploits. Installed roots include `node-forge@1.4.0`, `zod@3.25.76` under Expo CLI, `deepmerge@4.3.1`, and development `uuid` through `@expo/ngrok`. The app's direct ESLint-side Zod is already 4.6.7, but that does not replace the CLI's vulnerable copy. Most flagged paths are build/development tooling; the standalone assistant/admin servers use Node built-ins. Exploitability in the shipped mobile binary was not demonstrated.

Use Expo's supported resolver to review/update the six patches, then triage remaining advisories via compatible parent-package updates or reviewed patches. Do not use `--force` / `--legacy-peer-deps`, blindly substitute incompatible Zod majors, or accept npm's proposed Expo 51 downgrade. Dependency manifests/lockfile were **not changed** by this audit. Re-run all checks after remediation. Primary advisories: [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

For the dependency-remediation phase (not executed by this audit), first review the current patch plan, then use the SDK resolver and repeat acceptance:

```powershell
.\node_modules\.bin\expo.cmd install --check
.\node_modules\.bin\expo.cmd install --fix
npx.cmd --yes expo-doctor
npm.cmd audit
# Follow with the tests, lint, typecheck and exports listed below.
```

### 5. Resolve local account privacy and account lifecycle

This is a **source-confirmed finding**, not an authenticated login test: `TravelProvider` uses the same `@waylo/travel-state/v1` for every real account; the provider key in `src/app/_layout.tsx` only separates demo from device mode; logout deliberately leaves that collection intact. Consequently the implementation offers a shared device collection across real account changes. Cloud links include a user ID and RLS remains separate, so this is not evidence of remote RLS bypass.

Decide the intended shared-device behavior before release. Prefer explicit account-scoped collections with a non-destructive legacy-data adoption/export path, or clearly disclose and obtain the intended shared-device consent. Do **not** fix this by silently deleting local trips at logout.

Add a confirmed, reauthenticated account/data-deletion workflow and test associated cloud retention/deletion plus local export choices. Apple requires apps offering account creation to let users initiate account deletion in the app; deleting only a manual backup or cloud room is insufficient. See [Apple account-deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion). Publish accurate privacy/support information and app-store data disclosures; the current local FAQ/disclosures are not a complete release policy/support service.

### 6. Verify the actual Supabase installation with permission

Source/expected migrations:

1. `backend/supabase.sql` → `20261026000100_waylo_backend.sql`.
2. `backend/admin.sql` → `20261026000200_waylo_admin.sql`.
3. `backend/auth-profiles.sql` → `20261027000100_waylo_auth_profiles.sql`.
4. `backend/user-management.sql` → `20261027000200_waylo_user_management.sql`.

All prepared copies match source exactly, with hashes in the evidence. Source review confirms authenticated membership-only room reads, private backups/profiles, private admin tables, guarded admin functions, profile-only signup trigger and no role derivation from editable profile metadata. Real anonymous reads were denied with HTTP 401/403 **and PostgreSQL 42501** for seven tables and six read RPCs; generic failures did not count as denial.

No production catalog or migration-history read was available here. In the trusted dashboard/approved database context, review the read-only metadata in `backend/verify-schema.sql`, including RLS, table/column/function privileges, trigger and realtime publication. `backend/verify-auth.sql` additionally changes transaction-local roles and performs rolled-back update probes; it was **not run** and is not a plain metadata query.

Only after separately approving authenticated acceptance, test viewer/editor/outsider isolation, direct-write denial, concurrent stale revisions, expired/revoked invites, membership revocation, owner deletion, private backups, two-device realtime and offline reconnect. Apply **no SQL automatically**: compare the installed state first, then review any needed new migration. Also inspect Security Advisor, email rate limits, access protections, backup/PITR/restore and operational settings following [Supabase's production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

### 7. Create real release builds and deployment configuration

Both effective app identifiers are still `dev.waylo.travel`. No linked EAS project, `eas.json`, CI workflow, EAS Update URL/runtime version or signed APK/AAB/IPA was found in the checkout. EAS CLI is available, but no account/signing access was used. EAS Update is optional; if enabled it needs intentional runtime/channel/rollback configuration. The current export output is not an installable app. [Expo distinguishes EAS native binaries from JavaScript exports](https://docs.expo.dev/build/introduction/).

Choose stable store identifiers, link the intended Expo project, configure development/preview/production build profiles and private signing credentials, then produce real signed builds. Add a restricted Android Maps key/billing only if native embedded Android maps are in launch scope; current release configuration falls back to external maps. Configure iOS widget App Groups/signing and verify generated extensions.

After the owner authorizes Expo account/build setup and selects the intended project, the normal CLI sequence is `npx.cmd eas-cli@latest init`, `npx.cmd eas-cli@latest build:configure`, then—after defining the corresponding profiles—`npx.cmd eas-cli@latest build --platform android --profile preview` and `npx.cmd eas-cli@latest build --platform ios --profile preview`. These are future authenticated/cloud build operations, **not safe-audit commands run here**. Development-client profiles additionally need the compatible dev-client setup; an Expo Go bundle is not that client.

Install preview/release builds on physical iOS/Android devices. Accept native splash, cold/airplane-mode launches, auth restore, app/background refresh, real location, map fallback, calendar forms, notifications/deep links, share/import, widget/Live Activity update, Android Back, reduced motion, large fonts, 320-point layouts, screen readers, keyboard and measured animation responsiveness. Browser rendered review also remains blocked by the current tool failure.

Deploy admin and assistant as real separate HTTPS services with private environment injection, reverse-proxy Host/Origin preservation, appropriate timeouts/body limits and edge rate limits. Admin's asset build alone is not a deployed authenticated server: its current server reads `admin/public` and `assets/fonts`, so deploy the required source/assets or deliberately add/test a dist-serving path. The assistant Dockerfile is prepared but not built here. Neither production hosting, domain/TLS, monitoring, recovery, load limits nor rollback was verified.

Admin sessions and AI counters are in-memory, appropriate only for an intentionally configured single-instance deployment. Multi-instance hosting requires shared protected sessions/rate limits. Review admin MFA/access policy and provider abuse/billing controls. Add CI for tests/typecheck/lint/build/security checks, protect the release branch, and capture a reproducible release commit; this working tree contains earlier uncommitted work and was not committed/deployed by the audit.

### 8. Finish product scope and documentation

Translate remaining auth, dynamic and error copy and test Spanish/Hindi layouts; dictionary fallback is not complete multilingual support. Establish whether Android widgets, Siri, remote push, purchases, automatic backup and live bookings are part of launch. They are presently absent and must not be advertised as complete.

Update stale root README statements about OTP on every login and onboarding going straight to Home; the current source requires confirmed password authentication. Repair its older integration/setup references, including the nonexistent `docs/expansion-verification.md` referenced by the historical checklist. Keep historical acceptance clearly dated and separate from current evidence.

## Repeatable safe commands

```powershell
Set-Location 'D:\vi\MyApp'
npm.cmd test
npm.cmd run backend:test
npm.cmd run admin:test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run admin:build
npx.cmd --yes expo-doctor
npm.cmd audit --omit=dev
npm.cmd audit
.\node_modules\.bin\expo.cmd export --platform all --max-workers 1 --output-dir dist-native-production-audit
npm.cmd run backend:check -- --report
npm.cmd run admin:check -- --report
```

For public checks, the existing local admin/assistant servers must be running in separate terminals (`admin:start`, `backend:start`). Local dashboard: `http://127.0.0.1:8788`. Assistant health/readiness: `http://127.0.0.1:8787/health`, `http://127.0.0.1:8787/ready`. Then:

```powershell
npm.cmd run verify:public
node scripts/audit-public-providers.cjs
npm.cmd run backend:verify-live
npm.cmd run admin:verify-live
```

The last two commands deliberately remain **BLOCKED** without explicit `--authenticated` opt-in. Do not add it during safe audits. When separately authorized, the admin script uses two real confirmed accounts for read/denial/profile acceptance; the backend script uses four disposable accounts and creates/removes its own test trip/backup. Real AI additionally requires a separate billable opt-in. No credentials belong in chat, code, reports, Expo or public assets.

## Release decision

**No-go for production today.** Reassess after dependency/provider remediation, private email/backend/admin configuration, approved real auth/RLS/collaboration/AI acceptance, account lifecycle/privacy work, signed native/device QA, and verified HTTPS operations. Passing code tests and exports alone do not complete these release gates.
