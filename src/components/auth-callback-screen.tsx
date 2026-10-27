import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from './language-provider';
import { useCloud } from './cloud-provider';
import { ActionButton, PageHeading, Screen, TravelGate, ui } from './travel-ui';
import { j } from './journey-ui';
import { palette } from '@/constants/waylo';

export function AuthCallbackScreen() { return <TravelGate><CallbackContent /></TravelGate>; }
function CallbackContent() {
  const url = Linking.useLinkingURL(); const { completeCallback } = useCloud(); const [error, setError] = useState('');
  const work = useRef<{ url: string; promise: ReturnType<typeof completeCallback> } | null>(null);
  useEffect(() => {
    if (!url && !work.current) { setError('Open the newest confirmation or recovery link from your email.'); return; }
    let alive = true;
    const carriesAuth = !!url && /[?#&](?:access_token|refresh_token|token_hash|code|error|error_code)=/.test(url);
    if (url && (!work.current || work.current.url !== url && carriesAuth)) {
      // The promise is reused by Strict Mode effects and the credential-free URL update.
      work.current = { url, promise: completeCallback(url) };
    }
    void work.current?.promise.then((value) => { if (alive) router.replace(value.recovery ? '/reset-password' : '/'); }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : 'This email link couldn’t be verified. Request a fresh one.'); });
    return () => { alive = false; };
  }, [completeCallback, url]);
  return <Screen scroll><PageHeading title={error ? 'Let’s try a fresh link.' : 'Making a little connection.'} subtitle={error ? 'Your local trips are still saved.' : 'Verifying your email with Waylo.'} /><View style={j.content}>
    {error ? <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><ActionButton onPress={() => router.replace('/verify-email')}>Email verification</ActionButton><ActionButton secondary onPress={() => router.replace('/forgot-password')}>Password recovery</ActionButton><ActionButton secondary onPress={() => router.replace('/login')}>Back to sign in</ActionButton></> : <><ActivityIndicator color={palette.pine} /><Text style={ui.body}>Keep this page open for a moment. We’re verifying your account securely.</Text></>}
  </View></Screen>;
}
