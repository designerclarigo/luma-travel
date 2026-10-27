import { Tabs } from 'expo-router';
import { TravelTabBar } from '@/components/travel-tab-bar';

export const unstable_settings = { anchor: 'home' };

export default function MainLayout() {
  return <Tabs backBehavior="initialRoute" screenOptions={{ headerShown: false }} tabBar={(props) => <TravelTabBar {...props} />}>
    <Tabs.Screen name="home" options={{ title: 'Explore' }} /><Tabs.Screen name="saved" options={{ title: 'Saved' }} /><Tabs.Screen name="trips" options={{ title: 'Trips' }} /><Tabs.Screen name="profile" options={{ title: 'Profile' }} />
  </Tabs>;
}
