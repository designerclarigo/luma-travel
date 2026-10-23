import { Text, useLanguage } from '@/components/language-provider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Extrapolation, interpolate, runOnJS, type SharedValue,
  useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { LaunchIssue, useWayloLaunch } from '@/components/waylo-launch';
import { WayloMark } from '@/components/waylo-mark';
import { onboardingSlides, palette, type PhotoName, typography } from '@/constants/waylo';
import { createOnboardingCompletion, pageFromOffset } from '@/lib/onboarding-state';

export function OnboardingExperience({ replay = false }: { replay?: boolean }) {
  const launch = useWayloLaunch();
  if (launch.error) return <LaunchIssue />;
  if (!launch.ready) return <View style={styles.loading} />;
  if (launch.completed && !replay) return <Redirect href="/home" />;
  return <OnboardingFlow replay={replay} />;
}

function OnboardingFlow({ replay }: { replay: boolean }) {
  const { reducedMotion, revealed } = useWayloLaunch();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const initialWidth = Math.min(width - insets.left - insets.right, 520);
  const [pageWidth, setPageWidth] = useState(initialWidth);
  const [activeIndex, setActiveIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pager = useRef<ScrollView>(null);
  const activeRef = useRef(0);
  const locked = useRef(false);
  const savingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollX = useSharedValue(0);
  const heroHeight = Math.min(400, Math.max(200, (height - insets.top - insets.bottom - 248) * (fontScale > 1.3 ? 0.48 : 0.64)));
  const onComplete = useMemo(() => createOnboardingCompletion(AsyncStorage, () => { if (replay) router.dismissTo('/home'); else router.replace('/home'); }), [replay]);

  const settle = useCallback((offset: number) => {
    clearTimeout(settleTimer.current);
    const next = pageFromOffset(offset, pageWidth, onboardingSlides.length);
    activeRef.current = next;
    setActiveIndex(next);
    locked.current = false;
    setMoving(false);
  }, [pageWidth]);

  const scheduleSettle = useCallback((expectedOffset?: number) => {
    clearTimeout(settleTimer.current);
    // Also covers cancelled edge swipes and web scrolls without a momentum-end event.
    settleTimer.current = setTimeout(() => settle(expectedOffset ?? scrollX.get()), 520);
  }, [scrollX, settle]);

  const startDrag = useCallback(() => {
    clearTimeout(settleTimer.current);
    locked.current = true;
    setMoving(true);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.set(event.contentOffset.x); },
    onBeginDrag: () => { runOnJS(startDrag)(); },
    onEndDrag: () => { runOnJS(scheduleSettle)(); },
    onMomentumEnd: (event) => { runOnJS(settle)(event.contentOffset.x); },
  });

  // RN Web has no native drag/momentum events. Settle from its actual scroll offset,
  // while native keeps the Reanimated scroll handler and parallax on the UI thread.
  const webScrollHandler = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    scrollX.set(offset);
    locked.current = true;
    setMoving(true);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(offset), 160);
  }, [scrollX, settle]);

  const moveTo = useCallback((index: number) => {
    if (locked.current || savingRef.current) return;
    const next = Math.max(0, Math.min(onboardingSlides.length - 1, index));
    if (next === activeRef.current) return;
    locked.current = !reducedMotion;
    setMoving(!reducedMotion);
    setError(false);
    activeRef.current = next;
    setActiveIndex(next);
    pager.current?.scrollTo({ x: next * pageWidth, animated: !reducedMotion });
    if (reducedMotion) scrollX.set(next * pageWidth);
    else scheduleSettle(next * pageWidth);
  }, [pageWidth, reducedMotion, scheduleSettle, scrollX]);

  useEffect(() => {
    clearTimeout(settleTimer.current);
    pager.current?.scrollTo({ x: activeRef.current * pageWidth, animated: false });
    scrollX.set(activeRef.current * pageWidth);
    locked.current = false;
  }, [pageWidth, scrollX]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (savingRef.current || locked.current) return true;
      if (activeRef.current === 0) return false;
      moveTo(activeRef.current - 1);
      return true;
    });
    return () => subscription.remove();
  }, [moveTo]));

  useEffect(() => {
    if (revealed && !moving) AccessibilityInfo.announceForAccessibility(`Step ${activeIndex + 1} of 3. ${onboardingSlides[activeIndex].title.replace('\n', ' ')}`);
  }, [activeIndex, moving, revealed]);

  const complete = async () => {
    if (savingRef.current || locked.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    try {
      await onComplete();
    } catch (cause: unknown) {
      console.error('Waylo could not save onboarding completion.', cause);
      savingRef.current = false;
      setSaving(false);
      setError(true);
    }
  };

  const last = activeIndex === onboardingSlides.length - 1;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}
      aria-hidden={!revealed} accessibilityElementsHidden={!revealed} importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Brand />
          {!last ? <Pressable
            accessibilityRole="button" accessibilityLabel="Skip onboarding"
            accessibilityState={{ disabled: moving || saving }} disabled={moving || saving}
            onPress={() => void complete()} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable> : <View style={styles.headerPlaceholder} />}
        </View>

        <View style={styles.pager} onLayout={(event) => {
          setPageWidth(event.nativeEvent.layout.width);
          setMoving(false);
        }}>
          <Animated.ScrollView
            ref={pager} horizontal pagingEnabled directionalLockEnabled
            showsHorizontalScrollIndicator={false} bounces={false} overScrollMode="never"
            scrollEnabled={!saving} onScroll={Platform.OS === 'web' ? webScrollHandler : scrollHandler} scrollEventThrottle={16}
            decelerationRate="fast" keyboardShouldPersistTaps="handled"
            accessibilityLabel="Waylo welcome pages">
            {onboardingSlides.map((slide, index) => <SlidePage
              key={slide.photo} index={index} active={index === activeIndex}
              pageWidth={pageWidth} heroHeight={heroHeight} scrollX={scrollX}
            />)}
          </Animated.ScrollView>
        </View>

        <View style={styles.footer}>
          {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
            Your progress couldn’t be saved. Please try again.
          </Text>}
          <View style={styles.progressRow}>
            <View style={styles.backSlot}>
              {activeIndex > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Back"
                disabled={moving || saving} accessibilityState={{ disabled: moving || saving }}
                onPress={() => moveTo(activeRef.current - 1)} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Arrow direction="back" /><Text style={styles.backLabel}>Back</Text>
              </Pressable>}
            </View>
            <View style={styles.indicators} accessibilityRole="progressbar" accessibilityLabel="Onboarding progress"
              accessibilityValue={{ min: 1, max: 3, now: activeIndex + 1, text: `Step ${activeIndex + 1} of 3` }}>
              {onboardingSlides.map((slide, index) => <PageIndicator key={slide.photo} active={index === activeIndex} reducedMotion={reducedMotion} />)}
            </View>
            <Text style={styles.stepNumber} importantForAccessibility="no">0{activeIndex + 1}<Text style={styles.stepTotal}> / 03</Text></Text>
          </View>
          <PrimaryButton label={last ? 'Get Started' : 'Next'} busy={saving} disabled={moving || saving}
            reducedMotion={reducedMotion} onPress={() => { if (last) void complete(); else moveTo(activeRef.current + 1); }} />
          <Text style={styles.footerNote}>A lighter bag. A clearer mind.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SlidePage({ index, active, pageWidth, heroHeight, scrollX }: {
  index: number; active: boolean; pageWidth: number; heroHeight: number; scrollX: SharedValue<number>;
}) {
  const { reducedMotion, revealed } = useWayloLaunch();
  const slide = onboardingSlides[index]; const { t } = useLanguage();
  const reveal = useSharedValue(active ? 0 : 1);
  useEffect(() => {
    if (!active || reducedMotion || !revealed) { cancelAnimation(reveal); reveal.set(revealed ? 1 : 0); return; }
    reveal.set(0);
    reveal.set(withDelay(80, withTiming(1, { duration: 420 })));
    return () => cancelAnimation(reveal);
  }, [active, reducedMotion, reveal, revealed]);
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : interpolate(reveal.value, [0, 0.7], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: reducedMotion ? 0 : (1 - reveal.value) * 12 }],
  }));
  const descriptionStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : interpolate(reveal.value, [0.25, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: reducedMotion ? 0 : (1 - reveal.value) * 8 }],
  }));
  return (
    <ScrollView style={{ width: pageWidth }} contentContainerStyle={styles.slideContent}
      showsVerticalScrollIndicator={false} bounces={false} nestedScrollEnabled
      aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      <HeroComposition photo={slide.photo} height={heroHeight} index={index} pageWidth={pageWidth} scrollX={scrollX} />
      <Animated.View style={[styles.copy, headlineStyle]}>
        <View style={styles.eyebrowRow}><View style={styles.rule} /><Text style={styles.eyebrow}>{slide.eyebrow}</Text></View>
        <Text accessibilityRole="header" style={[styles.headline, pageWidth < 360 && styles.smallHeadline]}>{slide.title}</Text>
      </Animated.View>
      <Animated.Text style={[styles.description, descriptionStyle]}>{t(slide.description)}</Animated.Text>
    </ScrollView>
  );
}

function HeroComposition({ photo, height, index, pageWidth, scrollX }: {
  photo: PhotoName; height: number; index: number; pageWidth: number; scrollX: SharedValue<number>;
}) {
  const { photos, reducedMotion } = useWayloLaunch();
  const parallax = useAnimatedStyle(() => ({ transform: [
    { translateX: reducedMotion ? 0 : interpolate(scrollX.value - index * pageWidth, [-pageWidth, 0, pageWidth], [16, 0, -16], Extrapolation.CLAMP) },
    { scale: reducedMotion ? 1 : 1.08 },
  ] }));
  const image = <Animated.View style={[StyleSheet.absoluteFill, parallax]}>
    <Image source={photos[photo]} contentFit="cover" contentPosition={photo === 'packing' ? { left: '42%', top: '50%' } : 'center'}
      style={StyleSheet.absoluteFill} accessible={false} transition={0} />
  </Animated.View>;

  if (photo === 'journey') return (
    <View style={[styles.hero, { height }]} accessible accessibilityRole="image" accessibilityLabel="A wooden boat on an emerald lake beneath the Dolomites">
      <View style={[styles.archPhoto, styles.softShadow]}>{image}
        <View style={styles.destination}><View style={styles.destinationDot} /><Text allowFontScaling={false} style={styles.destinationLabel}>BRAIES, ITALY</Text></View>
      </View>
      <View style={styles.journeyTag}>
        <View style={styles.tagIcon}><WayloMark size={28} color={palette.pine} accentColor={palette.pine} /></View>
        <View><Text allowFontScaling={false} style={styles.tagEyebrow}>LESS TO CARRY</Text><Text allowFontScaling={false} style={styles.tagTitle}>More to discover.</Text></View>
        <Text allowFontScaling={false} style={styles.tagStar}>✧</Text>
      </View>
    </View>
  );

  if (photo === 'packing') return (
    <View style={[styles.hero, styles.packingStage, { height }]} accessible accessibilityRole="image" accessibilityLabel="A travel bag with an illustrative packing list: passport, favourite layers and little extras">
      <View style={styles.packingCircle} />
      <Svg width="100%" height="100%" viewBox="0 0 340 380" style={StyleSheet.absoluteFill}>
        <Path d="M30 64C180-10 265 12 296 78S238 340 55 336" stroke={palette.champagne} strokeWidth="1.5" strokeDasharray="4 6" fill="none" />
        <Circle cx="30" cy="64" r="4" fill={palette.pine} />
      </Svg>
      <View style={[styles.bagFrame, styles.softShadow]}>{image}</View>
      <View style={styles.packingLabel}><View style={styles.tinyRule} /><Text allowFontScaling={false} style={styles.packingLabelText}>JUST THE{ '\n' }GOOD STUFF.</Text></View>
      <View style={[styles.checklist, styles.softShadow]}>
        <Text allowFontScaling={false} style={styles.listEyebrow}>YOUR PACKING LIST</Text>
        {['Passport', 'Favourite layers', 'Little extras'].map((item) => <View key={item} style={styles.listRow}>
          <View style={styles.checkCircle}><Tick size={10} /></View><Text allowFontScaling={false} style={styles.listText}>{item}</Text>
        </View>)}
        <View style={styles.listRule}><View style={styles.listProgress} /></View>
        <Text allowFontScaling={false} style={styles.listFoot}>A little more prepared.</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.hero, { height }]} accessible accessibilityRole="image" accessibilityLabel="A quiet turquoise shoreline, framed as a sunlit oval postcard">
      <View style={styles.coastHalo} />
      <View style={[styles.coastPhoto, styles.softShadow]}>{image}</View>
      <Svg width="100%" height="100%" viewBox="0 0 340 380" style={StyleSheet.absoluteFill}>
        <Path d="M-12 281C50 328 97 305 113 274S96 241 87 264s38 53 100 25 132-50 166-23" stroke={palette.champagne} strokeWidth="2" fill="none" />
      </Svg>
      <View style={styles.readySeal}><Tick size={22} /><Text allowFontScaling={false} style={styles.sealText}>ALL SET</Text></View>
      <View style={styles.coastCaption}><Text allowFontScaling={false} style={styles.coastCaptionText}>TAKE THE SCENIC ROUTE</Text><Text allowFontScaling={false} style={styles.captionStar}>✧</Text></View>
    </View>
  );
}

function PageIndicator({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const size = useSharedValue(active ? 24 : 6);
  useEffect(() => {
    if (reducedMotion) { cancelAnimation(size); size.set(active ? 24 : 6); }
    else size.set(withSpring(active ? 24 : 6, { damping: 20, stiffness: 220 }));
  }, [active, reducedMotion, size]);
  const style = useAnimatedStyle(() => ({ width: size.value }));
  return <Animated.View style={[styles.indicator, style, active && styles.indicatorActive]} />;
}

function PrimaryButton({ label, onPress, busy = false, disabled = false, reducedMotion }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; reducedMotion: boolean;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => { if (reducedMotion) { cancelAnimation(scale); scale.set(1); } }, [reducedMotion, scale]);
  return <Animated.View style={[styles.buttonShadow, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={busy ? 'Saving your progress' : label}
      accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
      onPressIn={() => { if (!reducedMotion) scale.set(withSpring(0.98, { damping: 20, stiffness: 340 })); }}
      onPressOut={() => { if (!reducedMotion) scale.set(withSpring(1, { damping: 18, stiffness: 260 })); }}
      style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}>
      <Text style={styles.primaryLabel}>{busy ? 'Just a moment…' : label}</Text><Arrow />
    </Pressable>
  </Animated.View>;
}

function Brand() {
  return <View style={styles.brand} accessible accessibilityLabel="Waylo">
    <WayloMark size={32} color={palette.pine} accentColor={palette.champagne} /><Text allowFontScaling={false} style={styles.brandName}>waylo</Text>
  </View>;
}

function Arrow({ direction = 'forward' }: { direction?: 'back' | 'forward' }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" style={direction === 'back' ? { transform: [{ rotate: '180deg' }] } : undefined}>
    <Path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke={direction === 'back' ? palette.pine : palette.champagne} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

function Tick({ size }: { size: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="m5 12 4 4L19 6" fill="none" stroke={palette.pine} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export function CompletionScreen() {
  const launch = useWayloLaunch();
  const { height } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  if (launch.error) return <LaunchIssue />;
  if (!launch.ready) return <View style={styles.loading} />;
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.completion}>
      <Brand />
      <View style={styles.completionHero}><HeroComposition photo="weather" height={Math.min(380, height * 0.45)} index={0} pageWidth={400} scrollX={scrollX} /></View>
      <View><Text style={styles.eyebrow}>WELCOME TO WAYLO</Text><Text accessibilityRole="header" style={styles.headline}>{'Good things\nare up ahead.'}</Text>
        <Text style={styles.description}>A lighter way to get ready for your next adventure.</Text></View>
      <View style={styles.completionNote}><View style={styles.rule} /><Text style={styles.footerNote}>A little less packing. A lot more living.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: palette.pine },
  safe: { flex: 1, backgroundColor: palette.canvas },
  frame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { minHeight: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandName: { fontFamily: typography.editorial, fontSize: 32, lineHeight: 40, letterSpacing: -1.6, color: palette.ink },
  textButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end' },
  skip: { fontFamily: typography.medium, fontSize: 14, color: palette.muted },
  headerPlaceholder: { width: 48, height: 48 },
  pager: { flex: 1, minHeight: 0 },
  slideContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  hero: { width: '100%', marginBottom: 32 },
  archPhoto: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 24, borderTopLeftRadius: 180, borderTopRightRadius: 180, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', backgroundColor: palette.sage },
  softShadow: { shadowColor: palette.pine, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, shadowOpacity: 0.08, elevation: 2 },
  destination: { position: 'absolute', top: '42%', left: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24, backgroundColor: palette.canvas, paddingHorizontal: 12, paddingVertical: 8 },
  destinationDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.pine },
  destinationLabel: { fontFamily: typography.medium, fontSize: 9, letterSpacing: 1.4, color: palette.pine },
  journeyTag: { position: 'absolute', bottom: 0, left: 16, right: 16, minHeight: 72, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.pine, borderRadius: 16 },
  tagIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.champagne, alignItems: 'center', justifyContent: 'center' },
  tagEyebrow: { color: '#E0DCCF', fontFamily: typography.medium, fontSize: 9, letterSpacing: 1.6 },
  tagTitle: { color: palette.canvas, fontFamily: typography.editorial, fontSize: 22, lineHeight: 28 },
  tagStar: { color: palette.champagne, fontSize: 30, marginLeft: 'auto' },
  packingStage: { backgroundColor: palette.sage, borderRadius: 32, overflow: 'hidden' },
  packingCircle: { width: 260, height: 260, borderRadius: 130, backgroundColor: '#D9E0D2', position: 'absolute', top: -56, right: -64 },
  bagFrame: { position: 'absolute', top: '8%', right: '6%', width: '67%', height: '80%', borderRadius: 24, overflow: 'hidden', transform: [{ rotate: '6deg' }], backgroundColor: palette.canvasDeep },
  packingLabel: { position: 'absolute', left: 20, top: 24, gap: 12 },
  tinyRule: { width: 24, height: 2, backgroundColor: palette.pine },
  packingLabelText: { color: palette.pine, fontFamily: typography.medium, fontSize: 9, lineHeight: 16, letterSpacing: 1.6 },
  checklist: { position: 'absolute', bottom: 24, left: 16, minWidth: '53%', backgroundColor: palette.canvas, borderRadius: 16, padding: 16, transform: [{ rotate: '-4deg' }] },
  listEyebrow: { fontFamily: typography.medium, fontSize: 8, letterSpacing: 1.4, color: palette.muted, marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  checkCircle: { height: 16, width: 16, borderRadius: 8, backgroundColor: palette.sage, justifyContent: 'center', alignItems: 'center' },
  listText: { fontFamily: typography.sans, fontSize: 12, color: palette.ink },
  listRule: { height: 3, borderRadius: 2, backgroundColor: palette.canvasDeep, marginTop: 16 },
  listProgress: { height: 3, borderRadius: 2, width: '76%', backgroundColor: palette.champagne },
  listFoot: { fontFamily: typography.sans, fontSize: 9, marginTop: 8, color: palette.muted },
  coastHalo: { position: 'absolute', top: 0, bottom: 8, left: '8%', right: '4%', borderRadius: 200, borderWidth: 1, borderColor: palette.champagne, transform: [{ rotate: '8deg' }] },
  coastPhoto: { position: 'absolute', top: 8, bottom: 24, left: '9%', right: '9%', borderRadius: 200, overflow: 'hidden', backgroundColor: palette.sage },
  readySeal: { position: 'absolute', bottom: 24, right: '4%', width: 80, height: 80, borderRadius: 40, backgroundColor: palette.champagne, borderColor: palette.canvas, borderWidth: 5, justifyContent: 'center', alignItems: 'center', gap: 4, transform: [{ rotate: '8deg' }] },
  sealText: { fontFamily: typography.medium, fontSize: 8, color: palette.pine, letterSpacing: 1.5 },
  coastCaption: { position: 'absolute', bottom: 0, left: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  coastCaptionText: { fontFamily: typography.medium, color: palette.pine, fontSize: 8, letterSpacing: 1.6 },
  captionStar: { fontSize: 24, color: palette.pine },
  copy: { width: '100%' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  rule: { width: 24, height: 1, backgroundColor: palette.champagne },
  eyebrow: { fontFamily: typography.medium, fontSize: 11, letterSpacing: 1.5, color: palette.pine, flexShrink: 1 },
  headline: { fontFamily: typography.editorial, fontSize: 46, lineHeight: 47, letterSpacing: -1.3, color: palette.ink },
  smallHeadline: { fontSize: 40, lineHeight: 42 },
  description: { fontFamily: typography.sans, fontSize: 16, lineHeight: 24, color: palette.muted, marginTop: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 0, paddingBottom: 8, backgroundColor: palette.canvas },
  progressRow: { minHeight: 48, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backSlot: { flex: 1, minWidth: 72 },
  backButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  backLabel: { fontFamily: typography.medium, fontSize: 12, color: palette.muted },
  stepNumber: { flex: 1, textAlign: 'right', fontFamily: typography.medium, fontSize: 11, letterSpacing: 0.8, color: palette.pine },
  stepTotal: { color: palette.muted },
  indicators: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  indicator: { height: 6, borderRadius: 3, backgroundColor: '#D6DACE' },
  indicatorActive: { backgroundColor: palette.pine },
  buttonShadow: { borderRadius: 16, boxShadow: '0 6px 16px rgba(21,62,53,0.10)' },
  primary: { minHeight: 56, borderRadius: 16, backgroundColor: palette.pine, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  primaryPressed: { backgroundColor: '#235246' },
  primaryLabel: { flexShrink: 1, color: palette.canvas, fontFamily: typography.medium, fontSize: 15 },
  footerNote: { fontFamily: typography.sans, color: palette.muted, fontSize: 11, textAlign: 'center', paddingTop: 16 },
  pressed: { opacity: 0.6 },
  error: { color: palette.danger, fontFamily: typography.sans, fontSize: 13, lineHeight: 20, paddingTop: 8 },
  completion: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, gap: 32, justifyContent: 'space-between' },
  completionHero: { width: '100%' },
  completionNote: { alignItems: 'center', paddingBottom: 16 },
});









