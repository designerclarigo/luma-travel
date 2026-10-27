/** Keep unavailable native integrations out of the Expo Go startup path. */
export function runtimeCapabilities(platform: string, expoGo: boolean, googleMapsKey: boolean) {
  const native = platform === 'android' || platform === 'ios';
  return {
    calendar: native && !expoGo,
    localNotifications: native,
    widgets: platform === 'ios' && !expoGo,
    maps: platform === 'ios' || platform === 'android' && (expoGo || googleMapsKey),
  };
}
