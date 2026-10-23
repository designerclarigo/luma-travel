# Waylo welcome experience — verification

This records the earlier onboarding phase. Home now replaces the original welcome handoff; see `home-verification.md` for the current implementation and checks.

Verified on 22 October 2026 in `D:\vi\MyApp`.

## Automated checks completed

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no errors or warnings |
| `npm run typecheck` | Passed |
| `npm test` | 9 tests passed |
| `npx expo-doctor` | 21/21 checks passed |
| `npx expo export --platform all --output-dir dist --max-workers 2` | Android and iOS Hermes bundles and static web routes exported successfully |
| Native identity assets | Six PNGs regenerated from the existing vector mark, in ivory/forest/champagne |

Dependencies remain on SDK 57: Expo 57.0.31, Expo Router 57.0.29, React Native 0.86.3 and Reanimated 4.5.1. Expo, Expo Router and `@expo/ui` were updated to the patch versions recommended by the live Expo Doctor check. No force or legacy peer-dependency flags were used.

The persistence tests exercise fresh installs, the retained completion flag, unknown data, failed reads without writes, durable-write-before-navigation ordering, 20 simultaneous completion requests, failed-save retry, completion across a subsequent read, and pager offset boundaries. They use the real TypeScript persistence functions with an injected store; they do not prove native AsyncStorage behaviour on a device.

## Browser checks completed

- Visually inspected all three original photo compositions at 390 × 844.
- Inspected the small 320 × 568 layout. The document stays 320 pixels wide. Skip is 48 × 48, and the primary button is 272 × 56; content scrolls independently above the controls.
- Verified Next and Back navigation and that two rapid Next presses advance one page. Rechecked that the visible page and the accessible page stay aligned after the web-specific settlement fix.
- Inactive onboarding pages are hidden from accessibility navigation.
- Verified Skip from page two routes to `/ready`, then a fresh visit to `/` returns to `/ready` from the persisted browser flag.
- Verified the full Next → Next → Get Started flow reaches `/ready`.
- Saved the three 390 × 844 browser captures in `docs/previews`.

Open `previews/index.html` for the three captures, or `previews/waylo-overview.png` for the combined overview.

The browser tests used a dedicated local preview origin. Its test completion flag and the temporary viewport/motion emulation were reset after verification.

Browser previews are evidence for the shared React Native Web rendering, not native device screenshots.

## Native acceptance boundary

`adb devices -l` returned no connected Android device or emulator. No physical iPhone was available. The following remain unverified on hardware:

- The release-build native launch screen and its transition into the in-app splash. Expo Go/development builds are insufficient to approve native splash appearance.
- Native horizontal touch swiping, frame pacing, Android hardware/predictive Back, and interrupted gestures.
- iOS/Android safe-area and status-bar appearance on notched devices.
- Native Dynamic Type/font scaling, VoiceOver/TalkBack announcements, and changing Reduce Motion while the app is running.
- Persistence across a real native process kill/relaunch and device storage failures.

The implementation handles these cases, but successful bundles and browser checks do not establish device acceptance. There is no APK/IPA, installation or store release in this delivery.

## Handoff and scope

Skip and Get Started write `@waylo/onboarding-complete = complete` before `router.replace('/ready')`. Returning users use the same route. `/ready` is the repository's existing welcome handoff; a trip planner, dashboard and authentication do not exist in this checkout and were not invented for this change.

Fonts and photography are bundled and prepared before onboarding is revealed. Loading failures display a retry screen; storage write failures retain the current onboarding page. Reduced motion removes animated navigation, parallax, staggered text, logo movement and springs. Primary and descriptive text scale with the system; decorative text within the labelled illustrations retains its layout size.

`npm install` reported 21 dependency advisories (3 moderate, 18 high). No breaking `npm audit fix --force` upgrades were applied; Expo Doctor's package compatibility check is not a security audit.
