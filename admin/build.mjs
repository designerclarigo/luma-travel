import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// This is the CSS compiler already installed with this project's Expo toolchain.
const { transform } = require('lightningcss');
const output = new URL('./dist/', import.meta.url);
const assets = [
  ['public/index.html', 'index.html'], ['public/app.js', 'app.js'],
  ['public/model.mjs', 'model.mjs'], ['public/style.css', 'style.css'],
  ['../assets/fonts/CormorantGaramond-Medium.ttf', 'fonts/editorial.ttf'],
  ['../assets/fonts/DMSans-Regular.ttf', 'fonts/sans.ttf'],
  ['../assets/fonts/DMSans-Medium.ttf', 'fonts/medium.ttf'],
];
for (const name of ['server.mjs', 'config.mjs', 'setup.mjs', 'verification.mjs', 'verify-live.mjs', 'demo-data.mjs', 'seed-demo.mjs', 'check-setup.mjs', 'public/app.js', 'public/model.mjs']) {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL(name, import.meta.url))], { stdio: 'pipe' });
}
const allowed = new Set(assets.map(([, name]) => `/${name}`));
const html = readFileSync(new URL('./public/index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate IDs in the admin document.');
for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
  const link = match[1];
  if (link.startsWith('#') || link.startsWith('data:') || link.startsWith('https://')) continue;
  if (!allowed.has(link)) throw new Error(`Unknown local asset: ${link}`);
}
mkdirSync(new URL('./fonts/', output), { recursive: true });
const manifest = [];
let warnings = 0;
for (const [source, name] of assets) {
  let content = readFileSync(new URL(source, import.meta.url));
  if (/\.(?:html|js|mjs|css)$/.test(name) && /sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(content.toString('utf8'))) {
    throw new Error(`Credential-shaped value found in public asset ${name}; build stopped.`);
  }
  if (name === 'style.css') {
    const result = transform({ filename: name, code: content, minify: true });
    warnings += result.warnings.length;
    if (warnings) throw new Error('CSS compiler warnings must be resolved before building.');
    content = Buffer.from(result.code);
    for (const match of content.toString('utf8').matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (!allowed.has(match[1])) throw new Error(`Unknown stylesheet asset: ${match[1]}`);
    }
  }
  writeFileSync(new URL(name, output), content);
  manifest.push({ path: name, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
}
writeFileSync(new URL('build-manifest.json', output), JSON.stringify({ builtAt: new Date().toISOString(), backendRequired: true, assets: manifest, cssWarnings: warnings }, null, 2) + '\n');
console.log(`Admin build passed: ${assets.length} assets, JavaScript syntax valid, CSS compiled without warnings.`);
console.log('Output: admin/dist. This asset build still requires the existing authenticated Node admin server.');
