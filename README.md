# Waylo

Waylo is a native travel-discovery and packing app built with Expo SDK 57, React Native, Expo Router, and TypeScript. Home matches the approved welcome experience: warm ivory, deep forest, charcoal and champagne, bundled Cormorant Garamond and DM Sans, and destination photography that works offline.

## Run locally

```sh
npm install
npm run web
```

For native development builds, use `npx expo run:android` or `npx expo run:ios` on a machine with the corresponding native toolchain. The app icon, Android adaptive icon, and native splash are configured in `app.json`; Expo generates the native projects.

## Home and navigation

- Onboarding completion and returning launches open `/home`. `/ready` remains a compatible redirect to Home.
- `(main)` contains Explore, Saved, Trips and Profile tabs, with a custom native tab bar.
- Home includes a profile-based greeting and manually editable home location, search across destinations/stays/experiences, categories, budget/rating filters, popular destinations, a planning CTA and recommendations.
- Destination cards open `/destination?id=...`; bookmarks persist immediately after a successful local write and appear in Saved.
- `/search` defaults to live worldwide city/country autocomplete (GeoNames via Open-Meteo), with debouncing, disambiguated regions, loading/empty/error states and persisted place IDs/coordinates for plans and weather. A separate Waylo collection retains sample destination filters and sorting. Trips uses compact photographic cards and date-based status badges. See [implementation and verification](docs/worldwide-search-verification.md), including commercial API credential requirements.
- Destination details have offline galleries, expandable stories, highlights and suggested experiences that can be added to a plan.
- `/plan` creates or edits a dated itinerary with multiple destinations, 1–20 travelers, a group budget, interests and editable daily activities. Native calendar sheets select dates; trips can span up to 366 days. Each activity has a destination, time, notes and estimated per-person cost. Unsaved edits have an exit confirmation.
- Trips separates upcoming and past plans. `/trip?id=...` shows the itinerary, group budget, activity estimates and the existing packing checklist, with edit and confirmed delete actions.
- Profile includes editable details, travel defaults, local inbox preferences, privacy information and a safe `/onboarding` replay. Relaxed/Balanced/Adventurous preferences start new plans at six/four/seven days; every date remains editable.
- Notifications includes timestamps, per-message read state, trip links, mark-all-read, unread filtering and confirmed history clearing. These are local in-app messages, not device push notifications.
- `src/lib/travel-state.ts` validates saved data and serializes updates so rapid changes preserve bookmarks, plans and profile edits. Failed or corrupt reads show a retry state without overwriting the original data. Failed writes preserve the previous durable state.

There is no backend, account, payment or booking service. Destinations, USD prices and ratings are clearly labelled sample inspiration. The initial Alex Morgan profile is editable. All user data is local to the current device/browser origin.

The version-two travel schema retains `@waylo/travel-state/v1` and migrates earlier plans without removing profile details, bookmarks, trip IDs or checked essentials. Older plans receive clearly identified starter return dates, traveler counts and budgets for review. Migration is committed only with the next successful write. See `src/lib/travel-state.ts` and its production-model tests.

## Onboarding

- `src/app/index.tsx` starts the splash and first-run flow.
- `src/app/ready.tsx` forwards legacy handoff links to Home.
- `src/components/onboarding-experience.tsx` contains the native horizontal pager, three compositions, stable controls, parallax, staggered copy, spring indicators and button feedback.
- `src/components/waylo-launch.tsx` prepares fonts, decoded local photographs, saved progress and the motion preference; it hands the matching native logo to the short animated in-app splash.
- `src/lib/onboarding-state.ts` keeps the existing AsyncStorage completion key and coalesces duplicate completion requests.
- `src/components/waylo-mark.tsx` contains the original vector brand mark.
- `src/constants/waylo.ts` holds the palette, copy, and onboarding flow data.
- `assets/images/onboarding-*.jpg` contains the bundled onboarding photography.

Skip appears on the first two pages. Skip and Get Started both persist completion before replacing the route with `/home`. Returning users go to Home after loading resources. The existing onboarding completion key is retained.

The controls remain outside the pages' vertical scroll areas, including on small displays and with larger system text. Android Back moves to the preceding onboarding page; on the first page it falls through to the system. Reduced motion removes parallax, stagger, springs and route fades. Image composition labels belong to a single accessible illustration and retain their design size; functional text supports system font scaling.

Native launch uses the existing vector logo shape in the new palette, with the same centred 88-point mark as the in-app splash. Generate native PNGs again after editing the mark with `powershell -ExecutionPolicy Bypass -File scripts/generate-brand-assets.ps1`. Native splash changes require a new build. Expo recommends a release build for checking the final splash, since Expo Go and development builds do not reproduce it fully: https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform all --output-dir dist --max-workers 2
```

See `docs/screens-verification.md` for the current complete-screen checks and device acceptance boundaries. `docs/home-verification.md` and `docs/verification.md` record the earlier Home and onboarding phases. Font licenses are included beside the bundled files in `assets/fonts`; photo sources are recorded in `assets/images/destinations/README.md`.

The bundled Unsplash photos use image IDs `photo-1476514525535-07fb3b4ae5f1`, `photo-1553062407-98eeb64c6a62`, and `photo-1507525428034-b723cf961d3e`.
