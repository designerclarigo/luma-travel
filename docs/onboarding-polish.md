# Waylo splash and onboarding polish

Updated 28 October 2026. Keeps the existing forest/ivory/champagne palette, bundled Cormorant Garamond and DM Sans fonts, local photography and three-page native onboarding.

## Presentation

- In-app splash: a subtle champagne outline behind the original mark, a more generous wordmark, balanced tagline spacing and a small bottom signature. The native launch background/mark configuration is unchanged. The initial in-app mark still uses the existing size and centre point; the outline appears with the animated words. No new minimum launch delay was added, and the bounded launch/error/callback fallbacks remain.
- First page: an editorial arched destination photograph, intentional mountain/boat framing, restrained gradient for the place caption, a floating forest travel card and planning-focused copy.
- Second page: a proportionally framed travel bag and a clearly illustrative **Packing preview** card. Compact viewports use a smaller two-row preview and fewer decorations.
- Third page: a coastal postcard with layered sage/champagne framing and a smaller readiness seal on compact layouts.
- Refined heading line height, whitespace, header wordmark, Skip pill, divider, page indicator and 64-point primary button. Native-driven image parallax and swipe-linked text fades keep content transitions smooth without restarting text opacity when a page settles. Button feedback uses the shared spring settings and resets when disabled. Busy completion shows a real activity indicator.

## Responsive layout and behavior

Each page measures its actual copy height, including translated text and larger system font sizes, and sizes the hero from the remaining pager space. Small/landscape screens retain an inner vertical scroll area with the controls fixed outside it. Normal layouts keep room for the copy; large layouts cap artwork height. Decorative captions do not constrain the main text. Spanish/Hindi copy was updated with the new wording, including a system-font fallback for Hindi descriptions.

Swiping, Next, Back, Skip, Get Started, Android hardware Back, reduced motion, durable completion, returning-user routing, Profile replay and local demo access use their existing flows. No onboarding flag was reset and no account, trip or preference data was migrated.

## Review it

Reload the app for the updated in-app splash. To see onboarding again, open **Profile → Replay onboarding**. The desktop development route is `http://127.0.0.1:8081/onboarding`. Existing authenticated/demo users keep their normal Home entry; onboarding does not replay automatically after this update.

Expo Go can show the in-app splash. The OS-native launch appearance must be checked in a development/release build.

## Verification

187 regression tests passed, including new layout checks for measured copy, larger text, long translations, small/landscape screens and capped artwork on larger displays. Existing completion persistence/retry/repeated-tap and auth/demo tests passed. TypeScript and Expo lint passed.

Actual current build/bundle results are recorded in `verification/onboarding-polish-checks.json` and `verification/onboarding-polish-android.json`. Automated exports and source-bundle checks do not prove rendered layout, physical swipes, native launch alignment or frame rate. Browser automation could not start in this session, so no new rendered screenshot or physical-phone acceptance is claimed.

Final Android/iOS Hermes and web/36-route production exports passed. Metro's long-running development renderer reported an `unknown module` cache error during live checks; the owned Waylo server was restarted with `--clear`. A fresh complete Android bundle then returned HTTP 200 with valid JavaScript and all updated entry-flow markers, and `/onboarding` returned HTTP 200 without a Metro error. The dev server is left running. These HTTP checks do not verify browser hydration or native gestures.

Re-run the sanitized local runtime check with `node scripts/verify-onboarding-runtime.cjs` while Metro is running. It verifies the actual Expo Go manifest's complete bundle and the web route; it does not sign in or send email.
