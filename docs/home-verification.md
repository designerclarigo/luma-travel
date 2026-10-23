# Waylo Home — implementation and verification

22 October 2026 · `D:\vi\MyApp`

## Delivered behaviour

- Home uses the approved ivory/forest/champagne palette and bundled Cormorant Garamond / DM Sans fonts.
- Profile greeting and manually editable home location; avatar; local notification read status.
- Search across five bundled destinations, countries, stay types and experiences; categories; budget and rating filters; clearable empty results.
- Popular photo cards, recommended rows, persistent bookmarks and a working planning banner.
- Explore, Saved, Trips and Profile use Expo Router tabs with a custom native tab bar and explicit accessible selected states.
- Cards open destination details. Planning validates names and dates, creates a durable local trip, and opens its packing checklist. Packing progress persists.
- Skip, Get Started and returning launches now open `/home`; the existing onboarding key is retained and `/ready` redirects to Home.
- Storage loading skeleton, recoverable read-error gate, write-error messages and image retry placeholders are implemented. Writes are serialized and update the UI after persistence succeeds. Corrupt data is not overwritten.

The initial profile and destination catalog are sample content. USD starting prices, ratings, stays and experiences are illustrative; there is no booking service or live availability. Data stays on the device/browser origin.

## Automated checks completed

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Unit tests | 19 passed: 9 onboarding cases and 10 travel-data cases |
| Expo Doctor | 21/21 checks passed |
| Android, iOS, web export | Hermes bundles and all 16 static routes exported successfully |
| Whitespace check | `git diff --check` passed |

Tests cover multiword search, combined filters, new/reloaded saved state, 20 concurrent updates without lost changes, failed writes and subsequent recovery, corrupt reads without overwrites, profile/trip/bookmark coexistence, invalid dates, leap days and past-date rejection. The persistence tests use the production TypeScript store with an injected storage adapter; native AsyncStorage was not exercised on hardware.

Only `expo-linear-gradient` was added, using `expo install` to resolve the SDK 57 version. No forced peer-dependency or breaking audit upgrades were used.

## Browser checks completed

- Inspected Home at 390 × 844 and 320 × 568. At 320 pixels the document remains 320 pixels wide, with four 56-pixel-high navigation targets.
- Verified the active Explore tab exposes `aria-selected=true`, while the other tabs expose `false`.
- Searching Japan returns Kyoto; an unmatched query displays the empty state; clearing restores the catalog.
- Mountains returns Lago di Braies. A $200 budget returns Bali.
- Saved Bali, navigated to Saved, reloaded, and confirmed the bookmark remained. The same saved state appears on destination details.
- Verified the empty Trips state, destination details, and the destination-to-plan CTA.
- Invalid `2026-02-30` is rejected. A valid future date creates a trip and opens its checklist.
- Packed one item, reloaded the trip, and confirmed 1/5 remained packed.
- Edited the profile to Maya / Pune and confirmed the Home greeting and location updated.
- Opened Notifications and inspected the read state.
- Verified Skip reaches `/home` and a subsequent visit to `/` returns to Home using the saved completion flag.
- Saved a browser capture in `home-previews/waylo-home.jpg` and a small-phone capture in `home-previews/waylo-home-small.jpg`.
- Scrolled through and captured the planning banner and recommended destination cards in `home-previews/waylo-home-more.jpg`.

Browser checks used a separate local preview origin. Plans and edits made during interactive testing were preserved. Captures are React Native Web evidence, not native device screenshots.

## Device acceptance still required

`adb devices -l` returned no attached Android device or emulator. No iOS device session was available. Native touch/scroll performance, notched safe areas, keyboard behaviour, Android system Back, Dynamic Type and VoiceOver/TalkBack have not been verified on hardware. Reduced-motion branches are implemented, but native system preference changes remain a device acceptance check.

No APK/IPA was built, installed or published. The previous native splash release-build acceptance boundary also remains.

`npm install` reported 21 dependency advisories (3 moderate, 18 high). Expo Doctor checks SDK compatibility, not security; breaking audit fixes were not applied as part of this UI task.

## Run and review

```sh
npm run web
npm run android
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform all --output-dir dist --max-workers 2
```

On a fresh install, complete or skip onboarding to reach Home. Returning installations open Home using the same saved completion flag as before.
