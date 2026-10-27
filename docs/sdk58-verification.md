# Expo SDK 58 upgrade

26 October 2026. Project: `D:\vi\MyApp`.

## Implemented

- Upgraded to Expo **58.0.19**, React Native **0.88.0**, React/React DOM **19.3.0**, Expo Router **58.0.26**, Reanimated **4.7.1**, Worklets **0.13.0**, Gesture Handler **3.3.0**, and TypeScript **6.0.3**. Expo selected matching versions for all Expo/native dependencies. No force or legacy peer-resolution flags were used.
- Generated a clean lockfile after the old installed tree caused an npm peer-resolution conflict, then installed with `npm ci`. Verified every direct dependency against both the lockfile and installed package. The old lockfile is retained outside the app in `D:\vi\.sdk-backups\waylo-before-sdk58-clean-install`.
- Migrated the custom tab bar to Router 58's `emitter` / `navigateToTab(route.key)` API. Moved the Home back destination to `unstable_settings.anchor`. Preserved all four tabs, their appearance and Android back policy.
- Migrated scroll/pressable refs to React Native's strict `ScrollViewInstance` / `ViewInstance` types. Handled the nullable system color scheme without disabling strict checking.
- Deferred the entire iOS widget backend until a supported native build uses it. The original widget and Live Activity implementation is preserved unchanged in `waylo-widgets-runtime.ios.tsx`; Expo Go does not initialize its unavailable native module.
- Enabled Expo Go's bundled Android maps without requiring a project Google Maps key. Development/release Android builds still require their own key or show the existing external-map fallback.
- Enabled real local packing reminders and notification-tap routing in Expo Go. Native calendar editing remains visibly unavailable there; `.ics` export remains available.
- Awaited SDK 58's asynchronous `File.write()` before presenting a backup, trip or calendar file for sharing. Failed writes do not open sharing.
- Added `npm run start:go` and `npm run start:go:clean`. Updated the current setup notes. Existing theme, routes, storage keys, data formats, trips, packing rules, currency conversion, worldwide search, weather, account and backup features remain in place.

## Checks completed

| Check | Actual result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; installed the clean SDK 58 dependency tree |
| `npx expo install --check` | Dependencies up to date |
| `npx expo-doctor` | **20/20 passed** |
| `npm run typecheck` | Passed after the Router/ref migrations |
| `npm run lint` | Passed after the migrations |
| `npm test` | **101 passed, 0 failed** |
| `git diff --check` | Passed |
| `expo config --type public` | SDK `58.0.0`; Android, iOS and static web configuration resolved |
| `expo config --type introspect` | Passed; SDK 58 native configuration plugins resolved without generating `ios` / `android` folders |
| `expo export --platform all --output-dir dist --clear --max-workers 2` | Passed: Android and iOS Hermes bundles, web bundles and 30 static routes |
| Live Android and iOS development bundles | Both HTTP **200** from the running SDK 58 Metro server |
| Live Expo Go manifest | HTTP **200**, SDK `58.0.0`; also verified through the computer's Wi-Fi address |
| Browser smoke check at 390 × 844 CSS px | Onboarding Next/Next/Get Started reached Home; Home rendered; saving Bali reached Saved through the custom tab; the bookmark survived reload; Trips and Profile rendered; Profile → Explore worked; the budget sheet opened, updated its count and applied the selection; Home's Trip details opened the saved itinerary and Back returned to Home; an existing packing screen rendered. No browser error/warning entries were captured in the checked pages. |
| Compact browser layout at 320 × 700 CSS px | Reviewed the rendered next-trip dashboard, packing progress, actions and bottom navigation. This is browser emulation, not Android device acceptance. |

The four added SDK-specific tests exercise production capability policy, deferred widget loading in Expo Go/native builds, and asynchronous file-write/share ordering including failure. Native adapters are controlled in these tests; they do not simulate proof of a physical device permission dialog or notification delivery.

Sanitized configuration and live-response evidence are in `docs/verification/sdk58-public-config.json` and `docs/verification/sdk58-runtime.json`. Compiled outputs and downloaded live bundles are ignored build artifacts under `dist` and `.expo`.

## Open on the Android phone

1. Install/update [SDK 58-compatible Expo Go](https://expo.dev/go?device=true&platform=android&sdkVersion=58).
2. Keep the computer and phone on the same Wi-Fi.
3. Scan [the current session QR code](verification/sdk58-expo-go-qr.png) in Expo Go. The session URL is recorded in `verification/sdk58-runtime.json`.
4. For later sessions, run `npm run start:go` and scan the new terminal QR. The saved QR is specific to this computer's current network address and port.

Two stale pre-upgrade Waylo Metro servers were stopped before starting the SDK 58 server. No phone or emulator was attached in `adb devices -l`. Phone launch confirmation is pending; bundles and browser checks do **not** establish that the physical phone runs correctly.

## Native acceptance still needed

- On the phone: launch/relaunch, all tab and trip flows, Android Back and unsaved changes, maps, location permission/denial, local reminder permission/delivery/taps, haptics, gestures, file pickers/share sheets, persistence after force-close, offline use, enlarged text and reduced motion.
- [Native calendar editing](https://docs.expo.dev/versions/v58.0.0/sdk/calendar/) and [iOS widgets/Live Activities](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/) require development/release builds. They are preserved, with explicit Expo Go limits. No native binary or widget extension was built on this Windows machine.
- Expo Go cannot validate the final branded native splash; check a release build. Android development/release maps require the app's own configured Google Maps key. Remote push and Android widgets remain outside the app's implemented integrations.
- Cloud collaboration/account backup and AI refinement retain their existing real-backend requirements. No credentials, deployed service, live AI response, purchase or cloud sync was fabricated or verified by this upgrade.

Migration references: [SDK 58 release](https://expo.dev/changelog/sdk-58), [Router 57 → 58 migration](https://docs.expo.dev/router/migrate/sdk-57-to-58/), [React Native strict TypeScript refs](https://reactnative.dev/docs/strict-typescript-api), [SDK 58 file system](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/), [maps](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/), and [local notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/).
