const { networkInterfaces } = require('node:os');
const { isIPv4 } = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Expo can cache the first adapter it sees. Prefer the real Wi-Fi interface over
// Ethernet/VPN adapters so the QR, manifest and asset URLs agree with the phone.
function selectLanAddress(interfaces) {
  const candidates = Object.entries(interfaces).flatMap(([name, addresses]) =>
    (addresses ?? []).filter((address) => address.family === 'IPv4' && !address.internal &&
      isIPv4(address.address) && !address.address.startsWith('169.254.'))
      .map((address) => ({ name, address: address.address })));
  return candidates.find(({ name }) => /wi-?fi|wireless|wlan/i.test(name)) ??
    candidates.find(({ name }) => !/vethernet|virtual|docker|vpn|tun|tap|loopback/i.test(name)) ?? candidates[0];
}

function expoPort(args) {
  const inline = args.find((arg) => arg.startsWith('--port='));
  const index = args.indexOf('--port');
  const value = inline ? inline.slice(7) : index >= 0 ? args[index + 1] : '8081';
  if (!/^\d+$/.test(value ?? '') || Number(value) < 1 || Number(value) > 65535) throw new Error('Use a fixed Expo port from 1 to 65535.');
  return Number(value);
}

function start() {
  const args = process.argv.slice(2);
  if (args.some((arg) => ['--tunnel', '--localhost', '--dev-client', '--host'].includes(arg))) {
    throw new Error('This launcher uses Wi-Fi and Expo Go. Use npm run start:go:tunnel for a tunnel, or npx expo start for other runtimes.');
  }
  const port = expoPort(args);
  const lan = selectLanAddress(networkInterfaces());
  const environment = { ...process.env };
  if (!environment.EXPO_PACKAGER_PROXY_URL && lan) {
    environment.EXPO_PACKAGER_PROXY_URL = `http://${lan.address}:${port}`;
    console.log(`Waylo Expo Go: ${lan.name} · exp://${lan.address}:${port}`);
  }
  if (!lan) console.warn('No LAN IPv4 address was found. Connect to Wi-Fi or use npm run start:go:tunnel.');
  const cli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin', 'cli');
  const child = spawn(process.execPath, [cli, 'start', '--go', '--lan', ...args], {
    cwd: path.resolve(__dirname, '..'), env: environment, stdio: 'inherit',
  });
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

module.exports = { selectLanAddress, expoPort };
if (require.main === module) {
  try { start(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
