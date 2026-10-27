# Route timeline, weather and Home dashboard

Implemented and reviewed on October 26, 2026, in the existing Expo SDK 57 project.

## Implemented

- Numbered route timeline with destination names, country/region, dates, nights, inline date/activity warnings and collapsible date editors. Move up/down preserves each stay length, the overall trip dates and linked activity offsets. Saved array order is retained, including same-day stops. Existing destination discovery, maps, adding/removing stops and unsaved-change protection remain connected.
- Per-stop weather summaries use the existing real Open-Meteo forecast API and local cache. Temperature extremes, maximum daily rain probability, actual WMO conditions, covered travel days and fetch time are shown. Expand for daily conditions and the existing hourly sheet. Missing probabilities remain unavailable; out-of-range travel dates and stale data are labelled. Country/region forecasts identify their reference point. Seasonal averages remain explicitly separate from forecasts.
- Home uses actual saved trips to select the next upcoming journey (or an active journey first), show a calendar-day countdown and quantity-based packing progress. Continue Planning, packing and trip-detail actions open that trip. An empty state opens the planner. The date refreshes at midnight and when the app becomes active.
- Reused the shared safe-area screens, sheets, date picker, press feedback, reduced-motion policy, durable local store, packing rules and API parser. No additional dependency or API credential was introduced for these three changes.

## Checks completed

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 86 tests passed, zero failures; includes 8 new route/weather/dashboard tests |
| Production platform exports | Android, iOS and web exports passed |
| Empty Home dashboard | Rendered; Plan a trip opened the existing planner |
| Route persistence | Created a two-stop trip through the UI, moved Kyoto before Bali, saved, reloaded and confirmed order and dates remained |
| Linked activity | A Bali activity moved from day 1 to day 3 with its stop; its time, notes and estimate remained visible in trip details |
| Date conflict | Set Kyoto's departure to overlap Bali; warnings appeared on both stops, move controls disabled, Save displayed an error; restored valid dates |
| Real forecasts | Open-Meteo returned actual Kyoto and Denpasar forecasts; verified conditions, temperature/rain summaries, last-updated time, daily expansion and hourly sheet |
| Failed refresh and recovery | Temporarily blocked the forecast endpoint in the QA browser; connection errors appeared while cached details remained. Removed the block and successfully refreshed again |
| Weather-linked packing | Applied saved available weather to the packing list through the existing rule engine |
| Home progress and navigation | Packed 5 actual pieces, returned Home and verified 5/54 (9%); reloaded and confirmed persistence. Continue Planning, Open packing checklist and Trip details each opened the same saved trip |
| Discovery navigation | Expanded a stop and opened Discover Kyoto; the destination ID, coordinates and time zone remained correct |
| Responsive layout | Reviewed rendered Home and route at 320-point and 390-point widths, plus forecast details at 390; Home document width remained within 320 points and search text stayed on one line |

Automated tests also exercise shared travel days, zero-night stops, invalid trip dates, gaps, orphan activities, production-store round trips, partial/missing rain data, completed/past-trip exclusion and leap-year countdowns.

## Evidence

- [Home dashboard, 390 points](verification/home-trip-dashboard-390.png)
- [Home dashboard controls, 320 points](verification/home-trip-dashboard-320.png)
- [Route timeline, 390 points](verification/route-timeline-390.png)
- [Expanded real forecast, 390 points](verification/route-weather-details-390.png)

The review used an isolated local browser origin and a clearly named QA trip created through app controls. No production user records or weather responses were replaced with fixtures.

## Remaining acceptance boundary

- No physical iOS/Android device or simulator was available. Native safe-area insets, Android hardware Back, screen-reader traversal, system large-text settings, native keyboard/sheet gestures, haptics and frame rate still need device acceptance. Browser responsive inspection and native bundle exports do not prove those behaviors.
- Cached weather and local route/packing/dashboard records are usable without a weather connection. A first installation and a first forecast fetch still require the app/assets and online provider respectively; cold native airplane-mode launch was not tested.
- Forecast coverage remains limited to the provider's returned forecast window. Future dates outside it have no invented forecast. Existing Open-Meteo deployment/licensing configuration still applies; commercial deployment needs the appropriate provider arrangement.

