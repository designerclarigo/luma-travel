const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support.cjs');
const { onboardingLayout } = load('src/lib/onboarding-layout.ts');

test('welcome photography reserves enough room for measured copy in a typical phone viewport', () => {
  const available = 550, copy = 204;
  const layout = onboardingLayout(390, available, 1, copy);
  assert.ok(layout.heroHeight + copy + 48 <= available);
  assert.equal(layout.scrolls, false);
  assert.ok(layout.heroHeight >= 264);
});
test('larger text and longer translations shrink artwork before requiring vertical scrolling', () => {
  const normal = onboardingLayout(390, 550, 1);
  const enlarged = onboardingLayout(390, 550, 2);
  const translated = onboardingLayout(390, 550, 1, 400);
  assert.ok(enlarged.heroHeight < normal.heroHeight);
  assert.equal(enlarged.scrolls, true);
  assert.equal(translated.heroHeight, 152);
  assert.equal(translated.scrolls, true);
});
test('small and landscape phones retain readable type and a scrollable minimum composition', () => {
  for (const height of [100, 200, 320]) {
    const layout = onboardingLayout(320, height, 1.5);
    assert.ok(layout.headlineLineHeight >= layout.headlineSize * 1.15);
    assert.equal(layout.heroHeight, 152);
    assert.equal(layout.compactArtwork, true);
    assert.equal(layout.scrolls, true);
  }
});
test('large displays cap photo height and measured reflow controls the available space', () => {
  assert.equal(onboardingLayout(520, 900, 1, 204).heroHeight, 352);
  assert.ok(onboardingLayout(390, 550, 1, 300).heroHeight < onboardingLayout(390, 550, 1, 180).heroHeight);
  assert.ok(Number.isFinite(onboardingLayout(390, 550, NaN).heroHeight));
});
