// Local HTTP/source verification only. Does not operate a browser or authenticate a user.
const fs = require('node:fs');
const vm = require('node:vm');
async function verify() {
  const origin = 'http://127.0.0.1:8081';
  const manifestReply = await fetch(origin + '/', { headers: { 'expo-platform': 'android', 'expo-protocol-version': '1', accept: 'application/expo+json' }, signal: AbortSignal.timeout(20000) });
  if (!manifestReply.ok) throw Error(`Manifest HTTP ${manifestReply.status}`);
  const manifest = await manifestReply.json();
  const url = new URL(manifest.launchAsset.url);
  url.hostname = '127.0.0.1';
  url.searchParams.set('lazy', 'false');
  url.searchParams.set('transform.bytecode', '0');
  const bundle = await fetch(url, { signal: AbortSignal.timeout(240000) });
  if (!bundle.ok) throw Error(`Android bundle HTTP ${bundle.status}`);
  const source = await bundle.text();
  new vm.Script(source);
  const android = { checkedAt: new Date().toISOString(), manifestStatus: manifestReply.status, bundleStatus: bundle.status, bytes: Buffer.byteLength(source), syntaxValid: true, routerRoot: url.searchParams.get('transform.routerRoot'), containsPolishedCopy: source.includes('Plan it beautifully.'), containsSplashSignature: source.includes('PLAN WELL. TRAVEL LIGHT.'), containsMeasuredLayout: source.includes('measuredCopyHeight'), containsPackingPreview: source.includes('PACKING PREVIEW'), containsLocalDemo: source.includes('Try local demo'), browserInteractionTested: false, physicalPhoneTested: false };
  fs.writeFileSync('docs/verification/onboarding-polish-android.json', JSON.stringify(android, null, 2) + '\n');
  console.log(JSON.stringify(android, null, 2));
  if (!android.containsPolishedCopy || !android.containsSplashSignature || !android.containsMeasuredLayout || !android.containsPackingPreview || !android.containsLocalDemo) throw Error('The served bundle does not contain the complete current entry flow.');
  const page = await fetch(origin + '/onboarding', { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(240000) });
  const html = await page.text();
  const http = { checkedAt: new Date().toISOString(), status: page.status, bytes: Buffer.byteLength(html), metroError: /Requiring unknown module|Internal Server Error/.test(html), browserHydrationTested: false };
  fs.writeFileSync('docs/verification/onboarding-polish-http.json', JSON.stringify(http, null, 2) + '\n');
  console.log(JSON.stringify(http, null, 2));
  if (!page.ok || http.metroError) throw Error('The development onboarding route could not be rendered by Metro.');
}
verify().catch(error => { console.error(error.message); process.exitCode = 1; });
