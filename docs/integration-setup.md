# Waylo integration setup and acceptance boundaries

The local app works without credentials. No cloud or AI service is deployed by this change. Missing configuration has a visible unavailable state; no sample response, sync badge or purchase is substituted.

## Authenticated collaboration and account backup

1. Create a Supabase project you control. Review and deploy `backend/supabase.sql` through its SQL migration workflow. It creates RLS-protected rooms, members, hashed expiring invitations and a private manual-backup table. Mutations use authenticated functions with compare-and-set revisions.
2. Configure email/password authentication and email confirmation/delivery. Put the project URL and **public anon key** in the app's `.env.local` using `.env.example`. Never use a service-role key on a device.
3. Rebuild/restart Expo after changing public environment variables. Open Profile → Cloud account. Sign in, create a shared room from a trip and invite an editor or viewer. A code grants membership for the room; it is not a public anonymous document URL.
4. Changes publish and are accepted explicitly. Realtime reports that a newer revision exists; it never silently overwrites offline edits. A conflict rejects publication. Export unpublished device work, review/accept the cloud copy, then reapply changes.
5. Account backup is **manual**, one current backup per account. It includes personal trip/profile details, is protected by account RLS and can be deleted independently. Local files and downloaded copies remain separate.

Before production, run access tests against three real test accounts: uninvolved users cannot read; viewers cannot publish; editors can publish; simultaneous revisions reject one writer; expired/revoked codes cannot join; revoking membership removes future access; only an owner deletes a room; backup reads/writes/deletes are restricted to its owner. Also verify sign-out, token refresh, email verification and revoked sessions. These require a deployed database and were **not run here**. Review server-side quotas, retention, account deletion/export, abuse controls and privacy disclosures before offering accounts publicly.

## AI packing refinement

`backend/assistant-server.mjs` is a real authenticated proxy for the [OpenAI Responses API and Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). It validates the Supabase bearer token server-side. Set server-only environment values from `backend/.env.example`, including a model available to your account that supports the supplied strict schema, then run:

```
node --env-file=backend/.env.local backend/assistant-server.mjs
```

Deploy behind HTTPS with a reverse proxy/body timeout and an exact web-origin allowlist. Set `EXPO_PUBLIC_ASSISTANT_URL` to its full `/packing-chat` endpoint. The app deliberately accepts HTTPS only. The API key stays on the server. Requests omit traveler names and itinerary notes; user-entered prompts, dates, route, age bands and packing labels still leave the device after the user allows it. Responses use `store: false`; do not log prompts or trip bodies. Provider retention and your deployment's privacy obligations still apply.

The included in-memory per-user rate limiter is appropriate for a single-process development service. Use a shared durable rate limiter and enforce spending/abuse limits for multiple production instances. No provider call was made without credentials. Live auth, refusal/error handling and suggestion accuracy still need acceptance testing. The client validates every change again and applies only explicitly selected suggestions against the latest durable trip.

## Weather, discovery and maps

- Forecast and city lookup use real [Open-Meteo forecast](https://open-meteo.com/en/docs) and [GeoNames geocoding](https://open-meteo.com/en/docs/geocoding-api) responses. Six-hour forecast freshness is separate from displayed cache timestamps. Dates outside the returned range stay unknown or use explicitly labelled seasonal normals. The free API is for noncommercial use; review [commercial licensing and limits](https://open-meteo.com/en/terms) before commercial release, and configure a licensed backend/provider endpoint as needed.
- Bundled normals were calculated from actual 1991–2020 ERA5 daily observations through the [historical API](https://open-meteo.com/en/docs/historical-weather-api). Null/insufficient months are rejected. Current coverage is recorded in `src/constants/data/climate.json`; unsupported locations show unknown conditions. The refresh script saves only verified data and does not invent missing values.
- Nearby results use bounded 2 km / 40 named-result [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) requests. A production discovery service should add caching, quotas and an appropriate provider agreement. [OpenStreetMap attribution and ODbL](https://www.openstreetmap.org/copyright) are visible. Raw mapped hours are not asserted to be current opening hours.
- Native iOS maps use the system map provider. Android in-app maps require a restricted Google Maps key in `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, a billing-enabled appropriate project and a rebuilt native app. Without it the app clearly offers external maps. Web uses an explicit external-map fallback, not a WebView or pretend native map.

## Native build and devices

SDK 57 dependencies were installed with Expo's resolver. App configuration generates native extensions through CNG; no `ios/` or `android/` project was hand-written. Choose production bundle/package identifiers and configure Apple signing/App Groups for the widget extension. `dev.waylo.travel` is a development placeholder.

- Calendar uses SDK 57's calendar objects and system event form; .ics export is a static all-day itinerary copy with planned local times in descriptions. It deliberately avoids assigning invented event durations/time zones.
- Notifications are local scheduled packing reminders, not remote push. Permission is requested only on scheduling. Tapping opens packing, and deleted-trip reminders are cleaned up while the app runs. OS delivery is not guaranteed by a bundle check.
- iOS Home/Lock Screen widgets and Live Activities use [expo-widgets](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/). Add the widget through the OS gallery. Snapshots refresh from actual saved data while Waylo runs; iOS controls timing. Live Activities become stale after 15 minutes without an update. Widget taps open the authoritative app checklist; checking items inside an extension was deliberately not implemented with a disconnected mirrored state.
- Android widgets and Siri/App Intents are **not implemented**. They need additional native extension work and platform acceptance. Remote push needs APNs/FCM and a backend. No store billing products, entitlements or purchases are connected.

Use a development/release build for native acceptance. Expo Go and a browser do not prove native permissions, OS calendar forms, notifications, widgets, Live Activities, maps, share sheets or document pickers. Test those on physical iOS/Android devices, including denied permissions, small screens, large system fonts, reduced motion, offline launch, persistence and Android back behavior. No physical device was available for this expansion.
