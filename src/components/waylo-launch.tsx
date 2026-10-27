import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { Image, type ImageRef } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WayloMark } from '@/components/waylo-mark';
import { palette, type PhotoName, travelPhotos, typography } from '@/constants/waylo';
import { readOnboarding } from '@/lib/onboarding-state';

type LaunchState = {
  ready: boolean;
  fontsReady: boolean;
  motionReady: boolean;
  reducedMotion: boolean;
  completed: boolean;
  markOnboardingComplete: () => void;
  revealed: boolean;
  reveal: () => void;
  photos: Partial<Record<PhotoName, ImageRef>>;
  error: boolean;
  retry: () => void;
};
const LaunchContext = createContext<LaunchState | null>(null);

export function useWayloLaunch() {
  const value = useContext(LaunchContext);
  if (!value) throw new Error('WayloLaunchProvider is missing.');
  return value;
}

export function WayloLaunchProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);
  const [fontsReady, setFontsReady] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [state, setState] = useState({
    ready: false, completed: false, error: false, photos: {} as Partial<Record<PhotoName, ImageRef>>,
  });
  const markOnboardingComplete = useCallback(() => setState((previous) => ({ ...previous, completed: true })), []);

  useEffect(() => {
    let alive = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReducedMotion(value);
    }).catch(() => {
      // A failed preference read defaults to the motion-free experience.
    }).finally(() => { if (alive) setMotionReady(true); });
    return () => { alive = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    let alive = true;
    const fonts = Font.loadAsync({
      [typography.editorial]: require('../../assets/fonts/CormorantGaramond-Medium.ttf'),
      [typography.sans]: require('../../assets/fonts/DMSans-Regular.ttf'),
      [typography.medium]: require('../../assets/fonts/DMSans-Medium.ttf'),
    }).then(() => { if (alive) setFontsReady(true); });
    // Hold decoded image references for the session; no first-swipe image fetch.
    const photos = Promise.all(Object.entries(travelPhotos).map(async ([key, source]) => (
      [key, await Image.loadAsync(source)] as const
    ))).then(Object.fromEntries);
    void Promise.all([fonts, photos, readOnboarding(AsyncStorage)]).then(([, images, completed]) => {
      if (alive) setState({ ready: true, error: false, completed, photos: images });
    }).catch((error: unknown) => {
      console.error('Waylo launch preparation failed.', error);
      if (alive) setState((previous) => ({ ...previous, ready: false, error: true }));
    });
    return () => { alive = false; };
  }, [attempt]);

  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, ready: false, error: false }));
    setAttempt((value) => value + 1);
  }, []);
  return (
    <LaunchContext.Provider value={{ ...state, fontsReady, motionReady, reducedMotion, revealed, reveal, retry, markOnboardingComplete }}>
      {children}
    </LaunchContext.Provider>
  );
}

/** Matches the native splash's background, mark, size and centre point. */
export function WayloLaunchCurtain() {
  const { ready, error, fontsReady, motionReady, reducedMotion, completed, reveal } = useWayloLaunch();
  const [introDone, setIntroDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const markY = useSharedValue(0);
  const words = useSharedValue(0);
  const tagline = useSharedValue(0);
  const opacity = useSharedValue(1);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const hide = useCallback(() => { setHidden(true); reveal(); }, [reveal]);

  useEffect(() => {
    if (!fontsReady || !motionReady) return;
    if (reducedMotion) {
      cancelAnimation(markY); cancelAnimation(words); cancelAnimation(tagline);
      markY.set(-48); words.set(1); tagline.set(1);
      return;
    }
    markY.set(withSpring(-48, { damping: 24, stiffness: 150 }));
    words.set(withDelay(120, withTiming(1, { duration: 300 })));
    tagline.set(withDelay(260, withTiming(1, { duration: 320 }, (finished) => {
      if (finished) runOnJS(finishIntro)();
    })));
    return () => { cancelAnimation(markY); cancelAnimation(words); cancelAnimation(tagline); };
  }, [finishIntro, fontsReady, markY, motionReady, reducedMotion, tagline, words]);

  useEffect(() => {
    if (!motionReady || (!ready && !error)) return;
    if (!error && !completed && !reducedMotion && !introDone) return;
    opacity.set(withTiming(0, { duration: reducedMotion ? 0 : 200 }, (finished) => {
      if (finished) runOnJS(hide)();
    }));
    return () => cancelAnimation(opacity);
  }, [completed, error, hide, introDone, motionReady, opacity, ready, reducedMotion]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: markY.value }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: (1 - words.value) * 8 }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value }));
  const curtainStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (hidden) return null;
  return (
    <Animated.View style={[styles.curtain, curtainStyle]} accessibilityLabel="Waylo is starting" onLayout={() => {
      // The matching in-app mark is laid out: native launch can safely hand over.
      SplashScreen.hide();
    }}>
      <StatusBar style="light" animated={false} />
      <Animated.View style={[styles.splashMark, markStyle]}>
        <WayloMark size={88} color={palette.canvas} accentColor={palette.champagne} />
      </Animated.View>
      {fontsReady && <>
        <Animated.Text allowFontScaling={false} style={[styles.splashName, wordStyle]}>waylo</Animated.Text>
        <Animated.Text style={[styles.splashTagline, taglineStyle]}>A lighter way to get away.</Animated.Text>
      </>}
    </Animated.View>
  );
}

export function LaunchIssue() {
  const { retry, fontsReady } = useWayloLaunch();
  return (
    <SafeAreaView style={styles.issue}>
      <View style={styles.issueContent}>
        <WayloMark size={64} color={palette.pine} accentColor={palette.champagne} />
        <Text accessibilityRole="header" style={[styles.issueTitle, fontsReady && { fontFamily: typography.editorial }]}>A little pause.</Text>
        <Text style={styles.issueCopy}>We couldn’t prepare your welcome experience. Please try again.</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryLabel}>Try again</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  curtain: { ...StyleSheet.absoluteFill, backgroundColor: palette.pine, zIndex: 10 },
  splashMark: { position: 'absolute', top: '50%', marginTop: -44, alignSelf: 'center' },
  splashName: { position: 'absolute', top: '50%', marginTop: 16, alignSelf: 'center', color: palette.canvas, fontFamily: typography.editorial, fontSize: 48, lineHeight: 56, letterSpacing: -2 },
  splashTagline: { position: 'absolute', top: '50%', marginTop: 88, alignSelf: 'center', color: '#DEDCCF', fontFamily: typography.sans, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  issue: { flex: 1, backgroundColor: palette.canvas, justifyContent: 'center', padding: 32 },
  issueContent: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 24 },
  issueTitle: { fontSize: 40, color: palette.ink },
  issueCopy: { fontSize: 16, lineHeight: 24, color: palette.muted },
  retry: { minHeight: 56, padding: 16, borderRadius: 16, backgroundColor: palette.pine, alignItems: 'center', justifyContent: 'center' },
  retryLabel: { color: palette.canvas, fontSize: 16 },
});
