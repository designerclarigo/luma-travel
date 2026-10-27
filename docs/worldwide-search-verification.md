# Worldwide places and compact Trips

Implemented 23 October 2026 in the existing Expo SDK 57 app.

Updated on SDK 58 for mobile request recovery: see [phone search repair and actual checks](phone-search-verification.md). The current native request has bounded fetch/body deadlines and one native JSON-reader fallback; phone acceptance is reported separately.

## Delivered

- Main Search defaults to real worldwide autocomplete. A separate Waylo collection retains the five offline sample destinations, category/budget/rating filters and sorting. Sample content never enters live results.
- Shared autocomplete powers Planner, Route & weather and Discovery place pickers. Requests wait 350 ms, require at least two characters, abort on changes/unmount and suppress stale responses even if abort is ignored. Clear, loading, no matches, provider errors and Retry are distinct states.
- Results preserve GeoNames IDs (`geo-<id>`), WGS84 coordinates, region, country, ISO country code and time zone. Identical IDs are deduplicated; identically named places with different IDs remain separate. Administrative areas and coordinates distinguish them.
- Main Search opens a selection sheet, saves the place durably, then opens Planner. The previous worldwide-selection fallback to Bali is fixed. Unknown/unsaved place links offer recovery to Search. Single-stop saves retain a dated stop with the exact selected Place. Multi-stop editing retains each Place in its dated route.
- Countries and regions are identified as reference points. Their forecasts are explicitly for those coordinates, not an entire country or region. Users can add specific cities for local forecasts.
- Trips now uses compact native cards with 64/80 px wide thumbnails, city/country labels, dates, travelers, budget and restrained Upcoming/In progress/Past/Completed badges. Expired dates alone never claim completion. Worldwide places use a geographic icon instead of unrelated sample photography. Larger font scales remove the decorative thumbnail to reserve width for text; text wraps without line truncation.

## Provider, credentials and production boundary

Geocoding uses the actual [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), based on GeoNames. City queries can include a full country or region after a comma. The provider supports localized results; Waylo passes its selected en/es/hi language. This is online search, not an offline worldwide database.

**No credential is required for the connected evaluation/non-commercial endpoint.** No API key is bundled, and no new location permission is requested: queries are typed by the user. Existing saved places, trips and cached forecasts remain in local storage offline; new online matches require connectivity.

For a commercial release, [Open-Meteo requires a paid commercial subscription](https://open-meteo.com/en/pricing). Its free endpoint has usage limits and no uptime guarantee. Production still needs an account/API key and a backend proxy (or self-hosted provider) to keep the paid key out of the Expo bundle, provide quotas/caching and call the customer geocoding and weather endpoints. **That paid proxy and credentials are not configured or presented as deployed.** Do not put a private paid key in an `EXPO_PUBLIC_*` variable. The current integration uses the real public endpoint, subject to its terms and availability.

## Validation actually completed

- Lint and TypeScript: pass.
- Full regression suite: 72/72 pass, including eight new location/Trips tests. Tests exercise the production parser, qualifier/language encoding, debouncing before requests, cancellation after requests, obsolete-result suppression, zero matches versus failures, exact persisted coordinates reaching the forecast request and date-based badge distinctions. Controlled HTTP responses are test fixtures, not app results.
- Android, iOS and web production exports: pass, including 29 static web routes. No dependency was added for this work.
- Live production-module check (`node scripts/verify-location-search.cjs`): Paris/France, France country record, multiple Springfields, Mumbai/India and an actual no-match query passed. Paris ID `geo-2988507` and coordinates `48.85341, 2.3488` survived a saved-state round trip. A real 16-day forecast returned for that ID (provider grid coordinates `48.853382, 2.355208`).
- Browser: 390 px Search showed live Springfield results with Missouri, Illinois and Massachusetts distinctions. Selected Illinois (`geo-4250542`, `39.80172, -89.64371`), opened Planner, saved “Springfield city break,” opened Trip Details and Route & weather, and fetched real dated forecast values for America/Chicago. Loading state was visible during both location and forecast requests.

Additional browser checks completed:

- Home search opens worldwide autocomplete. A France query returns a labelled country reference point alongside distinct same-name towns in other countries. Selecting the country opens its explanatory sheet and saves a country-based trip without substituting a sample destination.
- A real zero-match query shows the helpful no-results state. Temporarily blocking only the geocoding endpoint in the dedicated QA tab shows the error/Retry state; removing that block and tapping Retry returns actual Lisbon results. The final build was checked again: its readable “Couldn’t reach location search. Check your connection and try again.” message appeared, and Retry recovered actual Rome results. All temporary request blocking and viewport overrides were cleared. The final QA tab’s captured error log was empty.
- Two plans created through the UI (a Bali sample plan and a France country plan) survive full browser reload. The compact card opens the correct Trip Details; Back returns to Trips and the existing Explore tab returns to Home.
- Compact photographic and geographic-fallback cards were reviewed at 390 × 844 and 320 × 568. The narrower review led to a shorter Trips heading/subtitle; the final 320px view shows the first card’s dates and budget above the bottom navigation. Search results were also reviewed at 320px, including wrapping region/country text. The Route picker independently returned a live Mumbai/India match, and closing it preserved the saved trip. The country-weather view shows its exact reference-point coordinates and limitation. Final screenshots are saved in `docs/verification`.

Evidence: [worldwide search, 390px](verification/worldwide-search-390.png), [compact Trips, 390px](verification/compact-trips-390.png), [compact Trips, 320px](verification/compact-trips-320.png). QA plans were created through visible app controls in a separate loopback preview origin; existing app data was not cleared or reset.

## Device-testing boundary

Browser review and successful native exports do not establish installed-device behavior. Physical iOS/Android keyboard dismissal, safe-area cutouts, Android hardware Back, VoiceOver/TalkBack, OS large-font settings, haptic feel, gestures and measured frame rates remain to be tested in development builds. Real geocoding and forecasts were verified; cloud collaboration, purchases and AI are not part of this change.
