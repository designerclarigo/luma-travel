import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from './language-provider';
import { useCloud } from './cloud-provider';
import { ActionButton, PageHeading, Screen, ui } from './travel-ui';
import { j } from './journey-ui';
import { palette } from '@/constants/waylo';
import { withDeadline } from '@/lib/async-deadline';

// This public route deliberately does not depend on device trips or onboarding assets.
export function AuthCallbackScreen() { return <CallbackContent />; }
function CallbackContent() {
  const url = Linking.useLinkingURL(); const { completeCallback } = useCloud(); const [error, setError] = useState('');
  const work = useRef<{ url: string; promise: ReturnType<typeof completeCallback> } | null>(null);
  useEffect(() => {
    if (!url && !work.current) { setError('Open the newest confirmation or recovery link from your email.'); return; }
    let alive = true;
    const carriesAuth = !!url && /[?#&](?:access_token|refresh_token|token_hash|code|error|error_code)=/.test(url);
    if (url && (!work.current || work.current.url !== url && carriesAuth)) {
      // The promise is reused by Strict Mode effects and the credential-free URL update.
      setError('');
      work.current = { url, promise: withDeadline(completeCallback(url), 30000, 'Email verification took too long. Check your connection, then request a fresh verification email. Your local trips are safe.') };
    }
    void work.current?.promise.then((value) => { if (alive) router.replace(value.recovery ? '/reset-password' : '/'); }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : 'This email link couldn’t be verified. Request a fresh one.'); });
    return () => { alive = false; };
  }, [completeCallback, url]);
  return <Screen scroll><PageHeading title={error ? 'A fresh code. A new start.' : 'Making a little connection.'} subtitle={error ? 'Your local trips are still saved.' : 'Verifying your email with Waylo.'} /><View style={j.content}>
    {error ? <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Text style={ui.body}>Already verified? Sign in with your email and password. New accounts can finish email verification inside Waylo.</Text><ActionButton onPress={() => router.replace('/login')}>Back to log in</ActionButton><ActionButton secondary onPress={() => router.replace('/verify-email')}>Verify my email</ActionButton><ActionButton secondary onPress={() => router.replace('/forgot-password')}>Password recovery</ActionButton></> : <><ActivityIndicator accessibilityLabel="Verifying your email" color={palette.pine} /><Text style={ui.body}>Keep this page open for a moment. We’re verifying your account securely.</Text></>}
  </View></Screen>;
}
