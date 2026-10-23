# Waylo capability checklist and implementation phases

Review date: 23 October 2026. Baseline: the existing SDK 57 native Waylo app, before this expansion. This is an implementation checklist, not a claim that integrations are deployed.

## Reference review

[Roam's App Store description, screenshots and complete visible version history](https://apps.apple.com/us/app/roam-travel-packing-lists/id6798393574) were reviewed. Advertised images show discovery, a dated route, a categorized checklist, weather, a passport/globe, distance records, voice control and activity-linked packing. These are marketing evidence, not hands-on verification of the installed app.

The visible release sequence runs from 1.0 to 1.23: route/weather/passport work; bag assignment and fit; templates and day planning; accessibility; categories; voice/widgets; broader discovery; finally family/cruise packing. Regression themes concern preserving edits, correct calculations, discoverable controls and honest uncertainty. The listing identifies English. AI chat and multilingual UI are additional user-requested scope, not verified claims about this competitor. Waylo will use original naming, layouts, photography and its established visual system.

## Baseline and planned work

| Capability | Existing Waylo | Phase / acceptance target |
| --- | --- | --- |
| First-run splash/onboarding | Present | Preserve completion and replay |
| Explore/search/saved/details | Present, five sample destinations | Preserve; expand actual place lookup |
| Trip/itinerary editing | Present | Preserve dates, notes, costs and edit/delete flows |
| Personalized packing | Five fixed essentials | 1: deterministic explainable rules |
| Smart quantities | Missing | 1: trip duration, travelers, laundry and explicit overrides |
| Laundry/luggage preferences | Missing | 1: explicit settings; never silently assume laundry |
| Family members and children | Missing | 1: named owners and age-aware lists |
| Cruise packing | Missing | 1: boarding/formal/theme inputs; explicit operator-policy links |
| Editable items/categories | Missing | 1: add/rename/move/reorder/delete, quantities, notes, essentials |
| Regeneration preserving edits | Missing | 1: stable rule identities, packed state, overrides and exclusions |
| Packing progress | Five-item checkbox progress | 1: item/quantity/category/owner views and batch actions |
| Multi-stop dates | Destination IDs only | 2: dates per stop, coverage validation and per-stop activities |
| Itinerary-linked suggestions | Activities do not affect packing | 2: explicit activity tags; reversible generated suggestions |
| Actual weather | Missing | 2: real dated forecast, source/cache timestamps and error states |
| Seasonal conditions | Missing | 2: sourced climate normals where available; explicit unknown elsewhere |
| Hourly forecasts | Missing | 2: only actual returned hours; respect destination time zones |
| Reusable templates/past-trip reuse | Missing | 3: editable reusable lists and deduplicating merge |
| Bag inventory/assignment | Missing | 3: personal/cabin/checked bags; dimensions, measured mass and assigned items |
| Airline bag fit | Missing | 3: cited dated policies, dimensional rotation, checked linear totals, measured mass and unknown allowances |
| Travel passport/globe | Missing | 3: offline geographic globe, country search, visited/wishlist and trip completion |
| Visited-country tracking | Missing | 3: editable records with explicit completion; preserve manual visits |
| Unused-item learning | Missing | 3: reversible post-trip feedback; repeated evidence before suppression |
| Text/file sharing | Missing | 4: actual platform share/copy and portable trip documents |
| Collaboration | Missing | 5: authenticated backend, membership and revision checks; unavailable until configured |
| Discovery/maps | Sample cards only | 4: real geocoding/place results, offline saved data, native/external map handoff |
| Multilingual support | English | 4: language setting and translated UI, with documented coverage |
| Offline persistence | Present | Preserve and migrate; cache external results honestly |
| Backup/restore | Missing | 4: versioned validated export/import, preview and non-destructive merge |
| Automatic cloud backup | Missing | 5: requires configured authenticated service; no fake sync badge |
| AI chat refinement | Missing | 5: authenticated server proxy; review changes before applying; no bundled provider secret |
| iOS widgets/Live Activities | Missing | 5: SDK-native extension, actual stored packing state; development build required |
| Android widgets | Missing | 5: assess supported package/native implementation; explicitly report gaps |
| Calendar/reminders/share/maps | Missing | 4/5: actual supported native APIs; platform availability and permissions |
| Siri/voice intents | Missing | 5: assess native extension requirements; no pretend shortcut |
| Purchases | No monetization | Do not invent prices/products/entitlements; store products and billing setup required for real purchases |
| Accessibility/large text | Shared labels, reduced motion, safe areas | Preserve, extend and test; distinguish browser and hardware evidence |

## Delivery rules

- Keep `@waylo/travel-state/v1` and migrate versions 1/2 without overwriting unreadable data. Preserve existing profile details, trips, IDs, notes, packed items, bookmarks and onboarding progress.
- Generated packing is local logic, explicitly labelled. It is not AI. Missing weather stays unknown, rather than becoming a fabricated forecast.
- Imported/shared data is validated before mutation. Native device identifiers and secrets are excluded from portable exports.
- Weather/geocoding/maps require network access; cached data is dated. Commercial provider licensing is a separate production requirement.
- Cloud collaboration and AI must authenticate and use configured services. Missing configuration produces an actionable unavailable state. No mock response may be presented as live.
- Platform-only work can be implemented and bundle-checked here, but cannot be claimed as hardware-verified without a device/build.

Phase results, exact verification and deployment blockers will be recorded in `docs/expansion-verification.md` as work completes.
