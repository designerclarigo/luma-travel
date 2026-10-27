import { type ConfigContext, type ExpoConfig } from 'expo/config';
import app from './app.json';
export default function configure({ config }: ConfigContext): ExpoConfig {
  const base = app.expo as ExpoConfig; const bundle = process.env.WAYLO_IOS_BUNDLE_ID ?? 'dev.waylo.travel';
  return { ...config, ...base, ios: { ...base.ios, bundleIdentifier: bundle, infoPlist: { NSSupportsLiveActivities: true } }, android: { ...base.android, package: process.env.WAYLO_ANDROID_PACKAGE ?? 'dev.waylo.travel' }, plugins: [
    ...(base.plugins ?? []).filter((plugin) => plugin !== 'expo-widgets'),
    ['expo-widgets', { groupIdentifier: `group.${bundle}`, widgets: [{ name: 'WayloPacking', displayName: 'Waylo · Ready to go', description: 'Your next trip and real packing progress.', ios: { supportedFamilies: ['systemSmall', 'systemMedium', 'systemLarge', 'accessoryRectangular', 'accessoryInline'] } }] }],
    ['expo-calendar', { calendarPermission: 'Add a trip to a calendar you choose.', remindersPermission: 'Add a packing reminder you choose.' }],
    ['expo-location', { locationWhenInUsePermission: 'Allow Waylo to show your current city and country on Explore.', locationAlwaysPermission: false, locationAlwaysAndWhenInUsePermission: false, motionUsagePermission: false, isIosBackgroundLocationEnabled: false, isAndroidBackgroundLocationEnabled: false, isAndroidForegroundServiceEnabled: false, isAndroidMotionActivityEnabled: false }],
    ['expo-notifications', { color: '#153E35' }],
    ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? [['react-native-maps', { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY }]] as NonNullable<ExpoConfig['plugins']> : []),
  ] as ExpoConfig['plugins'] };
}
