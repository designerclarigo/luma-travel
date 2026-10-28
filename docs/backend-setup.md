# Backend setup and verification

**Current audit — 28 October 2026:** See [current verification](verification-current.md). Local configuration has since been supplied and local health/readiness both return 200, but the app's assistant URL is blank. Real AI/authenticated acceptance was not run. The older missing-credentials state below is historical; both live scripts now save a fresh `BLOCKED` report by default and require a separately authorized `--authenticated` opt-in.

Updated 27 October 2026. The user's existing Supabase project is configured locally using its public publishable key. Both SQL files were executed successfully. Actual app signup, email confirmation, sign-in, private trip/packing publication and database read-back are verified through Expo web. The owner's approved exact account has admin access; real admin password login and display of the same trip/packing data passed. **The core local Supabase integration is verified; native-phone acceptance, production email/hosting and real AI remain outstanding.** No new Supabase project was created.

A separate premium **web admin dashboard** is available locally at port **8788**. See [admin setup, permissions and validation](../admin/README.md). Its database schema and the owner's approved administrator grant are installed. The AI server below remains on port 8787.

The later account update also installed **backend/auth-profiles.sql**: private registration profiles, guarded profile details in admin Users and exact development Auth callbacks. A real confirmed ordinary account signed in and appeared in admin with its registered name; the active admin count stayed one. Profile isolation/admin denial passed using live database roles, separately from password-login acceptance. See [current account setup and checks](auth-setup.md). The earlier six-table/core-schema evidence below describes the original two migrations.

## Current Supabase status

- Selected project: `alwvprhnokdcfnweiard`. The ignored root, `admin/` and `backend/` env files contain matching public project settings; no privileged key was used.
- Both canonical SQL files were applied manually through the authenticated SQL editor. This is not a claim that Supabase CLI migration history was updated. Treat these installed schemas as deployed; use a new migration for future changes.
- Live read-back verified all six Waylo tables have RLS, the expected mobile policies, 18 functions, protected admin tables and room realtime publication. Anonymous trip/admin HTTPS requests were denied. Evidence: [installed schema](verification/supabase-installed.json) and [public-access checks](verification/supabase-public-access.json).
- Email/password signup is enabled and confirmation is required. Custom SMTP was disabled at inspection. The original `localhost:3000` Site URL has now been replaced with `http://127.0.0.1:8081/auth/callback`, and four exact development redirects were saved/read back; see account setup for their scope. Production email delivery/HTTPS redirects remain outstanding. Supabase's default mail service has strict recipient/rate limits; public signup needs configured SMTP ([official SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp)).
- The owner created/confirmed the account and signed in through the app. The cloud check passed, then a test trip/packing list were explicitly published and read back. Matching dates, itinerary and 2/50 packed pieces were verified. Before its approved promotion, five admin read RPCs denied the normal account in a real database-role test; this does not replace a password-login test through the admin server. The exact approved account received its grant, signed in to admin and viewed the same real data, including partial packing quantity 1/2. User, trip, packing and membership views passed. See [the acceptance checklist](supabase-integration.md) and [live flow evidence](verification/supabase-flow.json).
- OpenAI key/model and a public HTTPS assistant endpoint are still missing. Cloud trip storage and the admin dashboard do not require the AI service.

## Ready locally

- Existing email/password authentication, explicit trip publication, owner/editor/viewer invitations, revision conflicts, membership removal and manual account backup remain connected to their screens.
- The Node assistant verifies the signed-in user with Supabase before calling the real OpenAI Responses API. Request context and proposed edits are validated. Refusals, incomplete output, per-user limits and cancellation are handled. The existing review/apply step controls all trip changes.
- `GET /health` reports process liveness. `GET /ready` reports configuration readiness, **not** successful authentication or model access. Missing configuration returns 503 for AI requests.
- Cloud account has a signed-in **Check cloud connection** action for schema and read-access checks without uploading a trip. The packing assistant has **Check backend connection** when a valid endpoint is configured. Neither check generates AI replies.
- Public publishable keys and legacy anon variables are supported. Supabase secret/service-role keys are rejected by configuration checks and are never required in the app.
- SQL is atomic and repeatable: policies are replaced in one transaction and records are preserved. The prepared initial migration contains exactly the same SQL. `backend/verify-schema.sql` offers read-only installation checks.

## Commands

From `D:\vi\MyApp`:

```powershell
npm run backend:setup
npm run backend:check
npm run backend:start
```

Setup creates blank, Git-ignored `.env.local`, `backend/.env.local` and `backend/verification.env.local` files **only when absent**. Existing files are preserved. It prepares `supabase/migrations/20261026000100_waylo_backend.sql`. Never edit a deployed migration; use a new migration for later database changes.

`backend:check` prints names/status, never secret values. Exit code 2 means incomplete setup. Add `-- --network` for real, read-only auth-service and HTTPS-backend reachability checks, and `--report` to save a sanitized report. These do not test sign-in or persistence.

This command audits the separate AI server as well as public app configuration. On 27 October the app's Supabase settings/project/key matched, while `OPENAI_API_KEY`, `OPENAI_MODEL` and the public assistant URL were absent. Its literal `not tested` / migration `not verified` fields describe checks **this configuration command does not perform**; the later real app/admin acceptance is recorded separately in [supabase-flow.json](verification/supabase-flow.json). Missing AI settings do not invalidate the verified Supabase trip/admin flow.

With no credentials, the local server demonstrates honest unavailable behavior:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
# HTTP 200: process is running
Invoke-WebRequest http://127.0.0.1:8787/ready
# HTTP 503 until server configuration is valid
```

## Required configuration

| File / environment | Variable | Supply |
| --- | --- | --- |
| Root `.env.local` | `EXPO_PUBLIC_SUPABASE_URL` | Your project's HTTPS origin |
| Root `.env.local` | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public `sb_publishable_...` key; legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` also works |
| Root `.env.local` | `EXPO_PUBLIC_ASSISTANT_URL` | Public HTTPS URL ending in `/packing-chat` |
| Server only | `OPENAI_API_KEY` | Your OpenAI project key; never an `EXPO_PUBLIC_*` variable |
| Server only | `OPENAI_MODEL` | An explicitly chosen, available model supporting the strict structured-output schema |
| Server only | `SUPABASE_URL` | The **same** project URL as the app |
| Server only | `SUPABASE_PUBLISHABLE_KEY` | The **same** public key as the app; legacy `SUPABASE_ANON_KEY` also works |
| Server only | `ALLOWED_ORIGINS` | Exact comma-separated web origins; blank is acceptable for native-only requests |
| Server only | `HOST`, `PORT` | Local: `127.0.0.1`, `8787`. Hosted container: `0.0.0.0` and the host's assigned port |

Do not paste secrets into chat or commit env files. The Docker context excludes env files. Configure production secrets through the host's environment settings.

## Supabase and authentication

1. Create a Supabase project you control; get the URL/public publishable key from its Connect/API-key settings. These flows do not need a service-role key.
2. Run **all** of `backend/supabase.sql` in its SQL editor, or apply the prepared migration through your normal Supabase CLI migration workflow. Do not reset the database. The script requires Supabase's existing `auth.users`, roles and `supabase_realtime` publication.
3. Run `backend/verify-schema.sql`. Expect RLS on all four tables, no anonymous trip/backup access, authenticated reads on rooms/members, private backups and execution of supported RPCs. Invitations are not directly readable by clients.
4. Enable email/password sign-in and configure email confirmation, a valid Site URL and email delivery/SMTP. The new account screens handle email confirmation and password-recovery callbacks; their real delivery/native acceptance boundaries are recorded in [account setup](auth-setup.md). No OAuth or passwordless magic-link sign-in UI was added.
5. Fill both local env files with matching project settings. Run `npm run backend:check -- --network`, then restart Metro to pick up changed `EXPO_PUBLIC_*` values.
6. Sign in through Cloud account and press **Check cloud connection**. An older schema without `waylo_status` is reported as requiring updated SQL. Test publication, invitations and backups with disposable accounts.

The SQL files were executed through the live Supabase dashboard on 27 October and their metadata was read back. Supabase, PostgreSQL and Docker CLIs were unavailable. Metadata and anonymous HTTP checks do not prove signed-in account isolation or the complete publication flow.

## Hosting and the physical phone

The app requires HTTPS. `localhost` points at the phone itself. A LAN `http://<computer-ip>:8787` URL is not accepted. Expo's Metro tunnel exposes the bundle server only; it does **not** expose port 8787.

Deploy this separate service to an HTTPS-capable Node/container host. A dependency-free Dockerfile is included:

```powershell
docker build -t waylo-assistant ./backend
```

The host must forward HTTPS to the container's `PORT`, inject server variables and set `HOST=0.0.0.0`. Use `/health` for liveness and `/ready` for readiness. The image was not built because Docker is unavailable. Alternatively, use `node backend/assistant-server.mjs` on a Node 24 host behind a TLS proxy. Bound request bodies and allow at least 60 seconds for assistant requests. Add edge request/connection limits. The per-user limiter is in memory and needs a durable shared replacement for multiple instances.

For development, a **separate** HTTPS tunnel can forward to `http://127.0.0.1:8787`; update the assistant URL when it changes. No backend tunnel is running or verified. An Expo tunnel URL cannot serve as the AI endpoint.

On the phone:

1. Open `https://<your-backend>/health` in its browser and confirm `service: waylo-assistant`.
2. Restart/reload Expo after configuring the full HTTPS `/packing-chat` URL.
3. Sign in, open a saved trip's packing assistant, check the connection, allow the displayed request data and send one packing question. Review suggestions; only selected changes may be applied.
4. On two devices/accounts, publish, join, edit, reject a stale revision and explicitly accept the cloud copy. Switch offline and check that the downloaded trip remains available. Local edits must not silently publish.

## Live acceptance command (prepared, not successfully run)

Create four **existing, confirmed, disposable** accounts: owner, editor, viewer and outsider. Enter credentials in `backend/verification.env.local`. The owner must have no existing account backup; the command refuses to replace one.

```powershell
npm run backend:verify-live
```

It signs in without creating users/sending email, checks the schema, creates a temporary trip using real app serialization, reloads it and checks permissions, viewer/editor roles, stale revisions, revocation, backup isolation and owner deletion. It removes its own test room/backup and signs out test sessions. Results go to `docs/verification/backend-live.json`; tokens, passwords and provider bodies are not logged. Use disposable accounts. Expired invitations, simultaneous writers, realtime delivery and email/session refresh need separate acceptance tests.

By default it does not contact OpenAI. Set `WAYLO_VERIFY_AI=1` locally to include **one real, billable** AI request using the owner's actual session and configured HTTPS endpoint. No simulated AI/sync result satisfies this command. Physical-phone interaction remains separate.

## Earlier local validation — 26 October

These results predate the live Supabase installation described above. They remain useful local evidence, but their missing-project status is historical.

| Check | Result |
| --- | --- |
| Backend/config tests | 14 passed with controlled auth/OpenAI test doubles, not live services |
| Complete app regression suite | 125 tests passed |
| TypeScript / Expo lint | Passed; regenerated Expo's local route types after a malformed cache was detected |
| Current Android Metro bundle | HTTP 200, 12,459,330 bytes; JavaScript syntax valid; includes updated service configuration and cloud check |
| Local running server | `/health` 200; `/ready` 503; `/packing-chat` 503 with credentials absent |
| Configuration | No configured project/API keys in local files or process/user environment. Blank local templates created and verified Git-ignored |
| Repeated setup | Existing local files preserved; initial migration matches the canonical SQL |
| Supabase migration / live authentication / shared persistence | Blocked by missing project/credentials; no live SQL or account requests |
| Real AI / public HTTPS / physical-phone backend access | Blocked by missing credentials/hosting; not tested |

Sanitized evidence: `docs/verification/backend-setup.json`, `backend-http.json` and `backend-android-bundle.json`. Local server checks came from this computer; no physical-phone backend connection is claimed. The server was started for verification; start it again with `backend:start` when configuring credentials.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Expo SDK 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/).
