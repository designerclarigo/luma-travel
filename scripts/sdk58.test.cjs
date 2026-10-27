const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { load } = require('./test-support.cjs');
const { runtimeCapabilities } = load('src/lib/runtime-capabilities.ts');

// Controlled native adapters verify module loading and async ordering. These are
// regression tests, not evidence of permission dialogs or behavior on a phone.
function nativeModule(file, adapters) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)((id) => {
    if (!(id in adapters)) throw new Error(`Unexpected native import: ${id}`);
    return adapters[id]();
  }, module, module.exports);
  return module.exports;
}

test('Expo Go enables bundled Android maps and local reminders while retaining native-only integration boundaries', () => {
  assert.deepEqual(runtimeCapabilities('android', true, false), { calendar: false, localNotifications: true, widgets: false, maps: true });
  assert.deepEqual(runtimeCapabilities('ios', true, false), { calendar: false, localNotifications: true, widgets: false, maps: true });
  assert.deepEqual(runtimeCapabilities('ios', false, false), { calendar: true, localNotifications: true, widgets: true, maps: true });
  assert.equal(runtimeCapabilities('android', false, false).maps, false);
  assert.equal(runtimeCapabilities('android', false, true).maps, true);
  assert.deepEqual(runtimeCapabilities('web', false, false), { calendar: false, localNotifications: false, widgets: false, maps: false });
});

test('iOS Expo Go never imports the missing widget backend, including after saved-state updates', async () => {
  let imports = 0;
  const widgets = nativeModule('src/lib/waylo-widgets.ios.tsx', {
    expo: () => ({ isRunningInExpoGo: () => true }),
    './runtime-capabilities': () => ({ runtimeCapabilities }),
    './waylo-widgets-runtime.ios': () => { imports++; throw new Error('Native module is absent in Expo Go'); },
  });
  assert.equal(widgets.widgetAvailable, false); await widgets.updatePackingWidget({ trips: [] });
  await assert.rejects(widgets.startPackingActivity({ id: 'trip' }), /development or release build/);
  await assert.rejects(widgets.endPackingActivities(), /development or release build/);
  assert.equal(imports, 0);
});

test('supported iOS builds defer the widget backend until an integration is actually used', async () => {
  const calls = []; let imports = 0; const state = { trips: [] };
  const widgets = nativeModule('src/lib/waylo-widgets.ios.tsx', {
    expo: () => ({ isRunningInExpoGo: () => false }),
    './runtime-capabilities': () => ({ runtimeCapabilities }),
    './waylo-widgets-runtime.ios': () => { imports++; return { updatePackingWidget: async (data) => calls.push(data), startPackingActivity: async (trip) => calls.push(trip.id), endPackingActivities: async () => calls.push('end') }; },
  });
  assert.equal(widgets.widgetAvailable, true); assert.equal(imports, 0);
  await widgets.updatePackingWidget(state); await widgets.startPackingActivity({ id: 'saved-trip' }); await widgets.endPackingActivities();
  assert.deepEqual(calls, [state, 'saved-trip', 'end']); assert.ok(imports > 0);
});

test('SDK 58 backup sharing waits for asynchronous file writes and never shares a failed write', async () => {
  const calls = []; let release; let fail = false;
  class File { constructor(root, name) { this.uri = `${root}/${name}`; } async write(text) { calls.push(['write', text]); await new Promise((resolve) => { release = resolve; }); if (fail) throw new Error('Disk is full'); calls.push(['written']); } }
  const files = nativeModule('src/lib/portable-files.ts', {
    'expo-document-picker': () => ({}),
    'expo-file-system': () => ({ File, Paths: { cache: 'file:///cache' } }),
    'expo-sharing': () => ({ isAvailableAsync: async () => true, shareAsync: async (uri) => calls.push(['shared', uri]) }),
  });
  const operation = files.writePortable('waylo-backup.json', 'real backup contents');
  await new Promise((resolve) => setImmediate(resolve)); assert.deepEqual(calls, [['write', 'real backup contents']]);
  release(); await operation; assert.deepEqual(calls.at(-1), ['shared', 'file:///cache/waylo-backup.json']);
  fail = true; const failed = files.writePortable('failed.json', 'contents'); await new Promise((resolve) => setImmediate(resolve)); release();
  await assert.rejects(failed, /Disk is full/); assert.equal(calls.filter((c) => c[0] === 'shared').length, 1);
});
