# Temporary local demo account

Updated 28 October 2026. Added at the owner's request while real registration email delivery is being configured. This is a **local development demo**, not a Supabase account or an email-verification bypass.

## Use it now

1. Reload the project in Expo Go, or open `http://127.0.0.1:8081/login` on this computer.
2. Complete onboarding if this device has never completed it.
3. On Login, Register or registration verification, tap **Try local demo**. No email, password or OTP is needed. The profile starts as **Demo Traveler**.
4. Explore destinations, save places, edit the demo profile, plan trips and pack. The demo collection starts empty; no fictional bookings or backend users are seeded.
5. Open the **Local demo** banner or Profile → **Exit local demo & sign in**, then tap **Exit demo & sign in**. Your regular device collection returns; both collections are kept separately.

The button appears above the real authentication form in development. It is absent in production/release runtimes. Existing confirmed Supabase sessions take priority and are never replaced with a fabricated demo session.

If Metro is stopped:

```powershell
Set-Location D:\vi\MyApp
npm.cmd run start:go -- --port 8081 --max-workers 1
```

Open Expo Go using the current terminal QR; `127.0.0.1` is this computer's browser address, not the phone's backend address.

## Data and permissions

- A non-secret demo access marker is stored at `@waylo/local-demo/session/v1`. It contains no password, JWT, email verification claim or administrator role.
- Demo trip/profile/preferences data uses the separate `@waylo/local-demo/data/` namespace. The regular `@waylo/travel-state/v1` value is not read, overwritten or erased by demo editing. Existing ordinary device data and encrypted native Supabase sessions are preserved.
- Exiting removes only the demo access marker. Re-entering restores the same demo collection. Restarting a development runtime can restore demo access; release runtimes ignore the marker and reject demo entry.
- No Supabase Auth user/profile, published room, membership, invitation or admin grant is created. **This local demo account will not appear in the real admin Users table.** The admin's existing separately labelled demo-data feature is unrelated and still requires a real administrator login.
- Cloud publishing/backups/collaboration and authenticated AI requests continue to require the real Supabase session. The cloud provider/session type and database/server administrator permissions are unchanged.
- Automatic device reminder cleanup/widget updates are suspended in demo. Native calendar editing, reminder scheduling/cancellation and widget/Live Activity controls are disabled with an explanation; demo plans cannot alter ordinary device integrations. Local settings, portable file exports and explicit calendar-file export remain available. External location/weather services retain their actual loading/error behaviour; no mock API replies were added.
- Nothing automatically merges or uploads when changing modes. File imports remain a separate explicit review-and-confirm action.

Real signup → received registration OTP → password login → admin visibility still needs the email setup documented in [auth-repair.md](auth-repair.md). Using the local demo does not complete that flow.

## Actual checks

- **183 tests passed**, including development entry/restart/exit, release rejection without storage reads/writes, invalid markers and storage failures, isolated profile/bookmark/trip/packing persistence, preservation of regular trip bytes and re-entry without collection merging.
- TypeScript and Expo lint passed.
- Production Android Hermes export passed in `dist-native-local-demo`; this is not an installed APK or an Expo Go interaction test.
- The complete current Android Metro source bundle returned HTTP 200, passed JavaScript syntax validation and contains demo entry/exit plus the isolated storage/guard code. Evidence: `verification/local-demo-android.json` and `verification/local-demo-checks.json`.
- Browser control could not start, so rendered layout, screen taps, native AsyncStorage across physical-phone restarts and device navigation remain **untested**. Unit tests use a controlled storage adapter. No live email delivery or cloud account creation is claimed.
