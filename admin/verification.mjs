export const liveCredentialNames = ['ADMIN_TEST_EMAIL', 'ADMIN_TEST_PASSWORD', 'ADMIN_NORMAL_TEST_EMAIL', 'ADMIN_NORMAL_TEST_PASSWORD'];
export function verificationEnvironment(base, local = {}) {
  // The private test file supplies credentials only, never a replacement API host/key.
  return { ...base, ...Object.fromEntries(liveCredentialNames.filter(name => Object.hasOwn(local, name)).map(name => [name, local[name]])) };
}
export function missingLiveCredentials(env) {
  return liveCredentialNames.filter(name => typeof env[name] !== 'string' || !env[name].trim());
}
