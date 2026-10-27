# Phone city-search repair

26 October 2026 · Expo SDK 58 · `D:\vi\MyApp`.

## Changes

- Worldwide search now has a dedicated JSON request path. Fetch requests have an eight-second deadline covering the response body as well as the initial connection. A stalled reader cannot leave the autocomplete waiting indefinitely.
- On Android/iOS, a transport or response-reader failure retries once through React Native's built-in native `XMLHttpRequest` reader, with its own bounded deadline. It uses the same HTTPS URL and real GeoNames/Open-Meteo response. HTTP failures, including rate limits, do not trigger duplicate provider requests.
- Typing a different query, clearing or leaving Search aborts both request paths. Late responses cannot overwrite the current query. The existing 350 ms debounce, result disambiguation, selection, IDs/coordinates, trip persistence and provider attribution remain intact.
- If both transports fail, Search offers its existing Retry action with an actionable connection message. No fabricated results, permissive TLS, API credentials, GPS permission, second geocoder or sample substitutions were introduced.

This addresses the reported mobile transport failure. The exact underlying phone DNS/TLS/reader error was not captured: the phone debugger disconnected before the diagnostic request could run. Do not describe the underlying cause or the physical-phone fix as confirmed until a phone retest succeeds.

## Checks completed

- `npm test`: **111 passed, 0 failed**, including seven native request regressions and three phone-launcher regressions.
- `npm run typecheck` and `npm run lint`: passed.
- Native request tests cover plain Expo fetch errors, a stalled body reader, ignored aborts, explicit cancellation, native XHR success/malformed data/timeouts, rate limits and complete transport failure. Controlled request adapters are test fixtures, not live app results.
- `node scripts/verify-location-search.cjs`: passed against the actual provider for Paris/France, France, Springfield, Mumbai/India and a no-match query. Selected Paris ID/coordinates survived a saved-state round trip and a real 16-day forecast returned for those coordinates. This ran on the computer's current network, not the phone.
- Updated live Android manifest and bundle: **HTTP 200**. The 12,452,819-byte bundle includes `createNativeLocationRequest`; its JavaScript syntax compiled successfully. This confirms Metro selected the native adapter, not the web-only request file.
- `git diff --check`: passed.

## Connection repair carried forward

The previous Expo Go connection investigation found two concrete issues: a Public-network Windows firewall block for `C:\Program Files\nodejs\node.exe`, and a running Metro session advertising an old Ethernet address. The approved administrator repair allows only TCP 8081 from `LocalSubnet` on the Wi-Fi interface; the explicit Node block still covers all other TCP ports. Firewall remains enabled. Local backup/result records are under `.expo/expo-go-firewall-*.json`. The repair script defaults to a read-only plan; administrator `-Undo` restores the prior all-port block and removes the owned Waylo rule.

`npm start`, `npm run start:go` and `npm run start:go:clean` now select the current Wi-Fi address dynamically and use Expo's documented `EXPO_PACKAGER_PROXY_URL`, preventing a cached Ethernet QR/asset address. A duplicate Waylo Metro was stopped. The machine changed Wi-Fi networks during testing; its current session uses `172.20.10.2:8081`. The current-session QR is `verification/phone-current-qr.png`; future sessions should use their newly printed QR.

Both Expo's default tunnel and its optional ngrok transport were attempted. The former exited with a TLS error during transfer; the latter reported gateway/connection failures. Those tunnel attempts are **not verified working connections** on this network. The development-only `@expo/ngrok` helper and explicit `start:go:tunnel` command are available for other networks; the repaired LAN session is the current delivery.

## Phone acceptance pending

An attached Expo Go Hermes runtime identified a **Xiaomi Redmi Note 7S**, proving it reached the development server at that point. It later disconnected. Physical search typing, provider success through the fallback, selecting a place and saving a trip still need a foreground phone retest. Reopen the current QR, search Mumbai and select the result; if a connection error remains, record the exact displayed message and check whether Expo Go has internet access on the phone's current network. No phone storage was reset.

References: [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api), [Expo SDK 58 fetch](https://docs.expo.dev/versions/v58.0.0/sdk/expo/#expofetch-api), [React Native networking/XHR](https://reactnative.dev/docs/network), [Expo CLI proxy URL](https://docs.expo.dev/more/expo-cli/#server-url).
