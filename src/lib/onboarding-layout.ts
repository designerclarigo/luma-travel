/** Reserve readable copy first; compact phones can scroll the page while controls stay fixed. */
export function onboardingLayout(width: number, pagerHeight: number, fontScale = 1, measuredCopyHeight = 0) {
  const compact = width < 360;
  const headlineSize = compact ? 40 : 46;
  const headlineLineHeight = compact ? 48 : 54;
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const copyReserve = 48 + (measuredCopyHeight > 0 ? measuredCopyHeight : 32 + (headlineLineHeight * 2 + 48 + 16) * scale);
  return {
    gutter: compact ? 20 : 24,
    pagerHeight,
    fontScale: scale,
    headlineSize,
    headlineLineHeight,
    heroHeight: Math.round(Math.max(152, Math.min(352, pagerHeight - copyReserve))),
    compactArtwork: pagerHeight - copyReserve < 264,
    scrolls: copyReserve + 152 > pagerHeight,
  };
}
