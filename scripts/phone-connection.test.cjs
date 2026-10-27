const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectLanAddress, expoPort } = require('./start-expo-go.cjs');
const address = (value, internal = false) => ({ address: value, family: 'IPv4', internal });

test('Expo phone launcher selects current Wi-Fi instead of the old Ethernet address', () => {
  const adapters = { Ethernet: [address('192.168.29.243')], 'Wi-Fi': [address('192.168.29.194')] };
  assert.deepEqual(selectLanAddress(adapters), { name: 'Wi-Fi', address: '192.168.29.194' });
  adapters['Wi-Fi'] = [address('192.168.29.210')];
  assert.equal(selectLanAddress(adapters).address, '192.168.29.210');
});

test('phone launcher rejects loopback/link-local addresses and prefers a physical LAN over virtual adapters', () => {
  const adapters = { Loopback: [address('127.0.0.1', true)], 'Wi-Fi': [address('169.254.1.2')], 'vEthernet (WSL)': [address('172.20.0.1')], Ethernet: [address('10.0.0.20')] };
  assert.deepEqual(selectLanAddress(adapters), { name: 'Ethernet', address: '10.0.0.20' });
  assert.equal(selectLanAddress({ Loopback: adapters.Loopback }), undefined);
});

test('the advertised Expo port matches CLI arguments and invalid/automatic ports are rejected', () => {
  assert.equal(expoPort([]), 8081);
  assert.equal(expoPort(['--clear', '--port', '8090']), 8090);
  assert.equal(expoPort(['--port=8087']), 8087);
  for (const args of [['--port'], ['--port', '0'], ['--port=65536'], ['--port=8081;whoami']]) assert.throws(() => expoPort(args), /fixed Expo port/);
});
