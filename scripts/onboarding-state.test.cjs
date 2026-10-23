const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real TypeScript persistence code without loading native modules into Node.
const source = readFileSync(resolve(__dirname, '../src/lib/onboarding-state.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const scope = { exports: {} };
vm.runInNewContext(compiled.outputText, scope);
const { readOnboarding, createOnboardingCompletion, pageFromOffset, onboardingStorageKey } = scope.exports;
const storage = (value) => ({ getItem: async () => value, setItem: async () => {} });

test('a fresh install enters onboarding', async () => {
  assert.equal(await readOnboarding(storage(null)), false);
});
test('the existing completion flag survives the design update', async () => {
  let key;
  assert.equal(await readOnboarding({ ...storage('complete'), getItem: async (value) => { key = value; return 'complete'; } }), true);
  assert.equal(key, '@waylo/onboarding-complete');
});
test('unknown data does not silently bypass onboarding', async () => {
  for (const value of ['', 'true', '{}']) assert.equal(await readOnboarding(storage(value)), false);
});
test('a failed read propagates to the retry gate without writing', async () => {
  let writes = 0;
  await assert.rejects(readOnboarding({ getItem: async () => { throw Error('unavailable'); }, setItem: async () => { writes++; } }), /unavailable/);
  assert.equal(writes, 0);
});
test('completion waits for a durable write before navigating', async () => {
  let release;
  let navigations = 0;
  const complete = createOnboardingCompletion({ ...storage(null), setItem: (key, value) => {
    assert.equal(key, onboardingStorageKey); assert.equal(value, 'complete');
    return new Promise((done) => { release = done; });
  } }, () => { navigations++; });
  const pending = complete();
  assert.equal(navigations, 0);
  release(); await pending;
  assert.equal(navigations, 1);
});
test('rapid completion presses produce one write and one navigation', async () => {
  let writes = 0; let navigations = 0;
  const complete = createOnboardingCompletion({ ...storage(null), setItem: async () => { writes++; } }, () => { navigations++; });
  await Promise.all(Array.from({ length: 20 }, complete));
  await complete();
  assert.equal(writes, 1); assert.equal(navigations, 1);
});
test('a failed save keeps the user on onboarding and permits retry', async () => {
  let attempts = 0; let navigations = 0;
  const complete = createOnboardingCompletion({ ...storage(null), setItem: async () => { if (++attempts === 1) throw Error('disk full'); } }, () => { navigations++; });
  await assert.rejects(complete(), /disk full/);
  assert.equal(navigations, 0);
  await complete(); assert.equal(navigations, 1);
});
test('completion is read correctly on the next launch', async () => {
  let saved = null;
  const store = { getItem: async () => saved, setItem: async (_, value) => { saved = value; } };
  await createOnboardingCompletion(store, () => {})();
  assert.equal(await readOnboarding(store), true);
});
test('page settlement handles boundaries, overscroll and resized pages', () => {
  assert.equal(pageFromOffset(0, 390, 3), 0);
  assert.equal(pageFromOffset(390, 390, 3), 1);
  assert.equal(pageFromOffset(780, 390, 3), 2);
  assert.equal(pageFromOffset(-40, 390, 3), 0);
  assert.equal(pageFromOffset(1400, 390, 3), 2);
  assert.equal(pageFromOffset(1040, 520, 3), 2);
});
