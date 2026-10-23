import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useWayloLaunch, WayloLaunchCurtain, WayloLaunchProvider } from '@/components/waylo-launch';
import { palette } from '@/constants/waylo';
import { TravelProvider } from '@/components/travel-provider';
import { LanguageProvider } from '@/components/language-provider';
import { CloudProvider } from '@/components/cloud-provider';
import { NativeTravelEffects } from '@/components/native-travel-effects';

void SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.pine }}>
      <SafeAreaProvider>
        <WayloLaunchProvider>
          <StatusBar style="dark" animated={false} />
          <TravelProvider><LanguageProvider><CloudProvider><WayloNavigator /><NativeTravelEffects /></CloudProvider><WayloLaunchCurtain /></LanguageProvider></TravelProvider>
        </WayloLaunchProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function WayloNavigator() {
  const { reducedMotion } = useWayloLaunch();
  return (
    <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'default', gestureEnabled: Platform.OS === 'ios', contentStyle: { backgroundColor: palette.canvas } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="ready" options={{ animation: reducedMotion ? 'none' : 'fade' }} />
      <Stack.Screen name="(main)" options={{ animation: reducedMotion ? 'none' : 'fade' }} />
      <Stack.Screen name="destination" />
      <Stack.Screen name="plan" />
      <Stack.Screen name="trip" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="search" />
      <Stack.Screen name="onboarding" options={{ animation: reducedMotion ? 'none' : 'fade' }} />
    </Stack>
  );
}
