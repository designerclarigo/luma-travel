# Waylo interface refinement

23 October 2026 · Expo SDK 57 · React Native 0.86

## Design and behavior

The existing ivory, forest, charcoal and champagne brand colors, bundled editorial/sans typography, photos, local data and routes are retained. Shared reading text uses a 17pt baseline with scalable text. Secondary labels remain smaller; the secondary neutral was darkened slightly because its previous contrast on sage was below 4.5:1. Shared surface/text pairs now have a regression check.

Native stack transitions use platform defaults, with launch/onboarding fades retained and no animated transition under reduced motion. Planner and dated-route unsaved-change guards keep their existing gesture restrictions and Android Back behavior. No Android gesture-navigation configuration was changed.

Shared controls use brief Reanimated press springs that animate transforms on the UI thread. The component retains native Pressable layout and responder behavior, and respects disabled/busy states. Busy buttons retain their labels and dimensions. Tabs have a quiet fading active surface, clear selected semantics, and larger text/targets. Confirmed destructive actions use the existing error color. Optional native haptics use the platform engines after selections or successful durable operations; they are throttled, disabled by reduced motion and controlled by a persisted Touch feedback preference. Web never simulates vibration. A fresh native build is needed to include the added SDK-compatible `expo-haptics` module.

Sheets now have a visible handle, spring settling, header-only downward drag dismissal, an explicit Close button, backdrop dismissal and Android modal Back handling. The body scrolls independently, avoids the keyboard and retains its last content during closing. Dismissal callbacks still own busy/unsaved guards. Shared screens have iOS keyboard avoidance and interactive keyboard dismissal, while Android retains OS resize behavior. Duplicate outer keyboard avoiders were removed from planner/account/assistant.

The calendar changes from seven columns to three on narrow screens or at increased font scale, retaining 48pt date targets. The gallery uses the available height, with previous/next boundaries disabled. Trip day selectors scroll horizontally. Globe drag updates are coalesced to animation frames, geometry is memoized, and vertical drags remain available to page scrolling. This targets smooth interaction; native frame rates have not been measured.

The shared heading, card, field, button, state panel, icon, switch and spacing changes apply throughout Home, Search, Saved, Destination, Planner, Trips, Packing, Route/Weather, Bags, Templates, Passport, Discovery, Notifications, Profile, Sharing, Backup, Account, Assistant and Integrations. Onboarding retains its approved compositions and motion, with clearer main copy/footer text and a supported shadow style. A themed not-found route provides recovery to Explore.

## Guidance consulted

- [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): scalable text, readable defaults, contrast, comfortable controls and alternatives to gestures.
- [Apple motion](https://developer.apple.com/design/human-interface-guidelines/motion): brief, purposeful feedback, familiar transitions and optional motion.
- [Apple sheets](https://developer.apple.com/design/human-interface-guidelines/sheets): explicit dismissal and focused presentation.
- [Android gesture navigation](https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and [Expo haptics](https://docs.expo.dev/versions/v57.0.0/sdk/haptics/).

These are design references, not a claim of Apple certification or a completed accessibility audit.

## Validation

Expo Doctor completed: 21/21 checks passed. Final lint, TypeScript, regression tests, platform exports and rendered route review are being recorded below as they finish.

## Device acceptance boundary

Browser screenshots and JavaScript/Hermes exports do not prove native touch latency, 60fps, safe-area cutouts, keyboard placement, predictive/system Back, VoiceOver/TalkBack, device font settings, native haptics or permission dialogs. Those checks require installed development builds on representative iOS and Android devices. No cloud, AI, weather, purchase or sync integration has been newly connected or simulated by this visual refinement.
