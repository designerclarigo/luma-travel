# Profile polish

23 October 2026 · React Native / Expo SDK 57

## Implementation

- Retains the approved ivory, forest, charcoal and champagne palette, bundled Cormorant Garamond / DM Sans fonts and four-tab navigation.
- The identity card uses initials derived from the saved name, the actual saved home location and an explicit Edit profile action. No fabricated portrait, membership status or travel achievements.
- Trip, saved-place and visited-country statistics open their corresponding screens. Trips includes every saved trip; saved places matches the visible destination catalog; visited countries deduplicates only passport records marked Visited. Planned stops and wishlist entries never count as visits.
- Preferences, the travel toolkit, and privacy/support are grouped in rounded cards with consistent stroke icons and inset dividers. Rows provide spring press feedback, disabled when reduced motion is requested.
- Separate native sheets edit identity, travel defaults and local-inbox settings. Each updates only its own fields against the latest durable state. Failed writes keep the editor open; save actions are locked against repeated presses. Cancel and dismissal discard drafts.
- Existing passport, packing templates, bags, discovery, backup, cloud account, notification inbox, calendar/native integrations and onboarding replay remain connected. Help opens useful expandable answers and routes to the existing tools; it does not claim a staffed support service.
- The existing safe-area container and tab bar retain inset ownership. Content scrolls; narrow phones reduce horizontal padding to 16px. Increased native font scale stacks identity, statistics and notification switch rows. The shared sheet keeps keyboard avoidance and Android modal Back handling.
- No dependencies, storage keys, schema versions or native permissions were changed. New primary labels are bundled in English, Spanish and Hindi; detailed help retains the project's existing partial-translation policy.

## Automated checks completed

- `npm run lint`: passed, no warnings.
- `npm run typecheck`: passed.
- `npm test`: 60 passed, including six Profile tests. These cover zero/real counts, deduplication, excluding wishlist/hidden notifications, Unicode initials, validation, immutable updates, independent preference patches, store reload and failed-write retry.
- `npx expo export --platform all --output-dir dist --max-workers 2`: passed for Android and iOS Hermes bundles and all 29 static web routes, including the final switch-spacing and preview thumb-color adjustments.

## Interactive verification

Completed in Chrome against the exported React Native Web app on the local QA preview:

- 390 × 844 overview and scrolled toolkit/privacy sections inspected visually.
- 320 × 568 inspected with a long three-part name and long location. Both wrap; document width remains 320px, with no horizontal overflow. Measured Profile action/tab targets are at least 48px high (statistics 92px, settings rows 72–75px, tabs 56px). Notification switches also have a 48px layout area and expanded native hit slop; hardware touch behavior remains untested.
- Blank-name validation keeps the edit sheet open and the saved identity unchanged. A valid trimmed name/location saves, changes initials, updates the existing Home greeting and survives reload. Cancel discards a draft. Original QA identity was restored.
- Travel defaults (interests, pace, party size) and both inbox switches saved independently and survived reload together. Hiding inspiration updates the actual unread badge. Original QA preferences were restored.
- Statistics opened My Trips (one upcoming and one past fixture), Saved (one visible destination) and Passport (one visited country, distinct from a wishlist entry).
- Profile tool routes opened templates, bags, discovery, cloud account, integrations and backup, with working return navigation. The notification bell opened the real local inbox and its empty state with inspiration hidden.
- Privacy content and its backup CTA, expandable support answers and the calendar/settings CTA worked. Replay opened the existing onboarding; Skip returned to Home with identity, trips, bookmarks and passport counts preserved.
- No console errors or warnings were recorded in the reviewed tab.

Evidence: [overview](verification/waylo-profile-390.png), [grouped sections](verification/waylo-profile-sections-390.png), [notification sheet](verification/waylo-profile-notifications-390.png), [320px with long identity](verification/waylo-profile-320-long-name.png). All screenshots show local QA records; the displayed counts are derived from those records. The final export was reloaded and the notification controls visually checked; temporary viewport overrides were reset after review.

## Boundaries

This is browser layout/flow verification, not an installed native-device test. OS keyboard behavior, Android hardware Back, VoiceOver/TalkBack, native safe-area cutouts, device text-size settings and on-device AsyncStorage still require a development build on hardware. Increased-font layout branches and reduced-motion press handling are implemented but were not device-tested here.

Existing external integrations retain their honest availability states. The account route reports that cloud credentials are not configured; discovery navigation was checked without claiming the previously blocked provider fetch is working. No cloud, AI, push, purchase or support backend was added or represented as connected in this UI task.
