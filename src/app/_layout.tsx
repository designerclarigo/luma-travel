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
import { CloudProvider, useCloud } from '@/components/cloud-provider';
import { signedIn } from '@/lib/email-otp-policy';
import { protectedRouteNames } from '@/lib/auth-routes';
import { NativeTravelEffects } from '@/components/native-travel-effects';
import { CurrencyProvider } from '@/components/currency-provider';

void SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.pine }}>
      <SafeAreaProvider>
        <WayloLaunchProvider>
          <StatusBar style="dark" animated={false} />
          <TravelProvider><LanguageProvider><CurrencyProvider><CloudProvider><WayloNavigator /><NativeTravelEffects /></CloudProvider><WayloLaunchCurtain /></CurrencyProvider></LanguageProvider></TravelProvider>
        </WayloLaunchProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function WayloNavigator() {
  const { reducedMotion, completed } = useWayloLaunch();
  const { session } = useCloud();
  const authenticated = signedIn(session);
  return (
    <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'default', gestureEnabled: Platform.OS === 'ios', contentStyle: { backgroundColor: palette.canvas } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="ready" options={{ animation: reducedMotion ? 'none' : 'fade' }} />
      <Stack.Screen name="account" />
      <Stack.Protected guard={completed && authenticated}>
        {protectedRouteNames.map((name) => <Stack.Screen key={name} name={name} options={name === '(main)' ? { animation: reducedMotion ? 'none' : 'fade' } : undefined} />)}
      </Stack.Protected>
      <Stack.Protected guard={completed && !authenticated}>
        <Stack.Screen name="login" /><Stack.Screen name="sign-up" /><Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Screen name="onboarding" options={{ animation: reducedMotion ? 'none' : 'fade' }} />
      <Stack.Screen name="auth/callback" options={{ animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="reset-password" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
