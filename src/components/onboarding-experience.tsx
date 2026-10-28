import { Text, useLanguage } from '@/components/language-provider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, BackHandler, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Extrapolation, interpolate, runOnJS, type SharedValue,
  useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { LaunchIssue, useWayloLaunch } from '@/components/waylo-launch';
import { EntryRedirect } from './entry-redirect';
import { WayloMark } from '@/components/waylo-mark';
import { onboardingSlides, palette, type PhotoName, typography } from '@/constants/waylo';
import { createOnboardingCompletion, pageFromOffset } from '@/lib/onboarding-state';
import { useAppAccess } from './local-demo-provider';
import { onboardingLayout } from '@/lib/onboarding-layout';
import { motion } from '@/constants/waylo';

export function OnboardingExperience({ replay = false }: { replay?: boolean }) {
  const launch = useWayloLaunch();
  const { canExplore, loading } = useAppAccess();
  if (launch.error) return <LaunchIssue />;
  if (!launch.ready) return <View style={styles.loading} />;
  if (!replay && loading) return <View style={styles.loading}><ActivityIndicator color={palette.pine} accessibilityLabel="Restoring your sign-in" /></View>;
  if (!replay && canExplore) return <EntryRedirect href="/home" />;
  if (launch.completed && !replay) return <EntryRedirect href="/ready" />;
  return <OnboardingFlow replay={replay} />;
}

function OnboardingFlow({ replay }: { replay: boolean }) {
  const { reducedMotion, revealed, markOnboardingComplete } = useWayloLaunch();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const initialWidth = Math.min(width - insets.left - insets.right, 520);
  const showFooterNote = height - insets.top - insets.bottom >= 700 && fontScale <= 1.25;
  const [pageWidth, setPageWidth] = useState(initialWidth);
  const [pagerHeight, setPagerHeight] = useState(Math.max(200, height - insets.top - insets.bottom - 72 - (showFooterNote ? 148 : 120)));
  const [activeIndex, setActiveIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pager = useRef<ScrollViewInstance>(null);
  const activeRef = useRef(0);
  const locked = useRef(false);
  const savingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollX = useSharedValue(0);
  const layout = onboardingLayout(pageWidth, pagerHeight, fontScale);
  const onComplete = useMemo(() => createOnboardingCompletion(AsyncStorage, () => { markOnboardingComplete(); if (replay) router.dismissTo('/home'); else router.replace('/ready'); }), [markOnboardingComplete, replay]);

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
        <View style={[styles.header, { paddingHorizontal: layout.gutter }]}>
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
          setPagerHeight(event.nativeEvent.layout.height);
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
              pageWidth={pageWidth} layout={layout} scrollX={scrollX}
            />)}
          </Animated.ScrollView>
        </View>

        <View style={[styles.footer, { paddingHorizontal: layout.gutter }]}>
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
          {showFooterNote && <Text style={styles.footerNote}>Made for the journey. Yours to begin.</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

function SlidePage({ index, active, pageWidth, layout, scrollX }: {
  index: number; active: boolean; pageWidth: number; layout: ReturnType<typeof onboardingLayout>; scrollX: SharedValue<number>;
}) {
  const { reducedMotion, revealed } = useWayloLaunch();
  const slide = onboardingSlides[index]; const { t, language } = useLanguage();
  const [copyHeight, setCopyHeight] = useState(0);
  const fitted = onboardingLayout(pageWidth, layout.pagerHeight, layout.fontScale, copyHeight);
  const reveal = useSharedValue(0);
  useEffect(() => {
    if (!revealed) return;
    if (reducedMotion) { cancelAnimation(reveal); reveal.set(1); return; }
    reveal.set(withDelay(40, withTiming(1, { duration: 360 })));
    return () => cancelAnimation(reveal);
  }, [reducedMotion, reveal, revealed]);
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : interpolate(reveal.value, [0, 0.7], [0, 1], Extrapolation.CLAMP) * interpolate(Math.abs(scrollX.value - index * pageWidth), [0, pageWidth * 0.5, pageWidth], [1, 0.7, 0], Extrapolation.CLAMP),
    transform: [{ translateY: reducedMotion ? 0 : (1 - reveal.value) * 12 }],
  }));
  const descriptionStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : interpolate(reveal.value, [0.25, 1], [0, 1], Extrapolation.CLAMP) * interpolate(Math.abs(scrollX.value - index * pageWidth), [0, pageWidth * 0.5, pageWidth], [1, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ translateY: reducedMotion ? 0 : (1 - reveal.value) * 8 }],
  }));
  return (
    <ScrollView style={{ width: pageWidth }} contentContainerStyle={[styles.slideContent, { paddingHorizontal: layout.gutter }]}
      showsVerticalScrollIndicator={fitted.scrolls} bounces={false} nestedScrollEnabled contentInsetAdjustmentBehavior="never"
      aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      <HeroComposition photo={slide.photo} height={fitted.heroHeight} index={index} pageWidth={pageWidth} scrollX={scrollX} />
      <View style={styles.copy} onLayout={(event) => setCopyHeight(event.nativeEvent.layout.height)}>
      <Animated.View style={[styles.copy, headlineStyle]}>
        <View style={styles.eyebrowRow}><View style={styles.rule} /><Text style={styles.eyebrow}>{slide.eyebrow}</Text></View>
        <Text accessibilityRole="header" style={[styles.headline, { fontSize: layout.headlineSize, lineHeight: layout.headlineLineHeight }]}>{slide.title}</Text>
      </Animated.View>
      <Animated.Text style={[styles.description, descriptionStyle, language === 'hi' && { fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', letterSpacing: 0 }]}>{t(slide.description)}</Animated.Text>
      </View>
    </ScrollView>
  );
}

function HeroComposition({ photo, height, index, pageWidth, scrollX }: {
  photo: PhotoName; height: number; index: number; pageWidth: number; scrollX: SharedValue<number>;
}) {
  const { photos, reducedMotion } = useWayloLaunch();
  const compact = height < 264;
  const drift = photo === 'packing' ? 4 : 8;
  const parallax = useAnimatedStyle(() => ({ transform: [
    { translateX: reducedMotion ? 0 : interpolate(scrollX.value - index * pageWidth, [-pageWidth, 0, pageWidth], [drift, 0, -drift], Extrapolation.CLAMP) },
    { scale: reducedMotion ? 1 : 1.06 },
  ] }));
  const image = <Animated.View style={[StyleSheet.absoluteFill, parallax]}>
    <Image source={photos[photo]} contentFit="cover" contentPosition={photo === 'journey' ? { left: '50%', top: '12%' } : photo === 'packing' ? { left: '42%', top: '48%' } : { left: '50%', top: '65%' }}
      style={StyleSheet.absoluteFill} accessible={false} transition={0} />
  </Animated.View>;

  if (photo === 'journey') return (
    <View style={[styles.hero, { height }]} accessible accessibilityRole="image" accessibilityLabel="A wooden boat on an emerald lake beneath the Dolomites">
      <View style={[styles.archFrame, styles.softShadow]}><View style={[StyleSheet.absoluteFill, styles.archPhoto]}>{image}
        <LinearGradient colors={['transparent', 'rgba(15,47,39,0.82)']} style={styles.destinationShade} />
        {!compact && <View style={styles.destination}><View style={styles.destinationDot} /><Text allowFontScaling={false} style={styles.destinationLabel}>BRAIES, ITALY</Text></View>}
      </View>
      </View>
      <View style={styles.journeyTag}>
        <View style={styles.tagIcon}><WayloMark size={28} color={palette.pine} accentColor={palette.pine} /></View>
        <View style={styles.tagCopy}><Text allowFontScaling={false} numberOfLines={1} style={styles.tagEyebrow}>YOUR NEXT CHAPTER</Text><Text allowFontScaling={false} numberOfLines={1} style={styles.tagTitle}>Room to roam.</Text></View>
        <Text allowFontScaling={false} style={styles.tagStar}>✧</Text>
      </View>
    </View>
  );

  if (photo === 'packing') return (
    <View style={[styles.hero, styles.packingStage, { height }]} accessible accessibilityRole="image" accessibilityLabel="A travel bag with an illustrative personal packing checklist">
      <View style={styles.packingCircle} />
      <Svg width="100%" height="100%" viewBox="0 0 340 380" style={StyleSheet.absoluteFill}>
        <Path d="M30 64C180-10 265 12 296 78S238 340 55 336" stroke={palette.champagne} strokeWidth="1.5" strokeDasharray="4 6" fill="none" />
        <Circle cx="30" cy="64" r="4" fill={palette.pine} />
      </Svg>
      <View style={[styles.bagFrame, styles.softShadow]}>{image}</View>
      {!compact && <View style={styles.packingLabel}><View style={styles.tinyRule} /><Text allowFontScaling={false} style={styles.packingLabelText}>A LITTLE{ '\n' }MORE PREPARED.</Text></View>}
      <View style={[styles.checklist, styles.softShadow, compact && styles.compactChecklist]}>
        <Text allowFontScaling={false} style={styles.listEyebrow}>PACKING PREVIEW</Text>
        {(compact ? ['Passport', 'Everyday layers'] : ['Passport', 'Everyday layers', 'Little essentials']).map((item) => <View key={item} style={styles.listRow}>
          <View style={styles.checkCircle}><Tick size={10} /></View><Text allowFontScaling={false} style={styles.listText}>{item}</Text>
        </View>)}
        <View style={styles.listRule}><View style={styles.listProgress} /></View>
        {!compact && <Text allowFontScaling={false} style={styles.listFoot}>Everything in its place.</Text>}
      </View>
    </View>
  );

  return (
    <View style={[styles.hero, { height }]} accessible accessibilityRole="image" accessibilityLabel="A quiet turquoise shoreline, framed as a sunlit oval postcard">
      <View style={styles.coastHalo} /><View style={styles.coastInnerHalo} />
      <View style={[styles.coastPhoto, styles.softShadow]}>{image}</View>
      <Svg width="100%" height="100%" viewBox="0 0 340 380" style={StyleSheet.absoluteFill}>
        <Path d="M-12 281C50 328 97 305 113 274S96 241 87 264s38 53 100 25 132-50 166-23" stroke={palette.champagne} strokeWidth="2" fill="none" />
      </Svg>
      <View style={[styles.readySeal, compact && styles.compactSeal]}><Tick size={compact ? 18 : 22} /><Text allowFontScaling={false} style={styles.sealText}>ALL SET</Text></View>
      <View style={styles.coastCaption}><Text allowFontScaling={false} style={styles.coastCaptionText}>TAKE THE SCENIC ROUTE</Text><Text allowFontScaling={false} style={styles.captionStar}>✧</Text></View>
    </View>
  );
}

function PageIndicator({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const size = useSharedValue(active ? 28 : 6);
  useEffect(() => {
    if (reducedMotion) { cancelAnimation(size); size.set(active ? 28 : 6); }
    else size.set(withSpring(active ? 28 : 6, { damping: 24, stiffness: 240 }));
  }, [active, reducedMotion, size]);
  const style = useAnimatedStyle(() => ({ width: size.value }));
  return <Animated.View style={[styles.indicator, style, active && styles.indicatorActive]} />;
}

function PrimaryButton({ label, onPress, busy = false, disabled = false, reducedMotion }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; reducedMotion: boolean;
}) {
  const { t } = useLanguage();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => { if (reducedMotion || disabled) { cancelAnimation(scale); scale.set(1); } }, [disabled, reducedMotion, scale]);
  return <Animated.View style={[styles.buttonShadow, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={t(busy ? 'Saving your progress' : label)}
      accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
      onPressIn={() => { if (!reducedMotion) scale.set(withSpring(0.985, motion.press)); }}
      onPressOut={() => { scale.set(reducedMotion ? 1 : withSpring(1, motion.press)); }}
      style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed, disabled && !busy && styles.primaryDisabled]}>
      <Text style={styles.primaryLabel}>{busy ? 'Just a moment…' : label}</Text><View style={styles.primaryArrow}>{busy ? <ActivityIndicator size="small" color={palette.champagne} /> : <Arrow />}</View>
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
  header: { minHeight: 72, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontFamily: typography.editorial, fontSize: 34, lineHeight: 40, letterSpacing: -1.2, color: palette.pine },
  textButton: { minWidth: 64, minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: palette.sage, justifyContent: 'center', alignItems: 'center' },
  skip: { fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.pine },
  headerPlaceholder: { width: 64, height: 48 },
  pager: { flex: 1, minHeight: 0 },
  slideContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  hero: { width: '100%', marginBottom: 24 },
  archFrame: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 24, borderTopLeftRadius: 160, borderTopRightRadius: 160, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: palette.sage },
  archPhoto: { borderTopLeftRadius: 160, borderTopRightRadius: 160, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  softShadow: { boxShadow: '0 8px 24px rgba(21,62,53,0.09)' },
  destinationShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%' },
  destination: { position: 'absolute', bottom: 56, left: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  destinationDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.champagne },
  destinationLabel: { fontFamily: typography.medium, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, color: palette.canvas },
  journeyTag: { position: 'absolute', bottom: 0, left: 16, right: 16, minHeight: 72, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.pine, borderRadius: 16 },
  tagIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.champagne, alignItems: 'center', justifyContent: 'center' },
  tagCopy: { flex: 1, minWidth: 0, gap: 4 },
  tagEyebrow: { color: '#E0DCCF', fontFamily: typography.medium, fontSize: 8, lineHeight: 12, letterSpacing: 1.2 },
  tagTitle: { color: palette.canvas, fontFamily: typography.editorial, fontSize: 20, lineHeight: 24 },
  tagStar: { color: palette.champagne, fontSize: 24, marginLeft: 'auto' },
  packingStage: { backgroundColor: palette.sage, borderRadius: 32, overflow: 'hidden' },
  packingCircle: { width: 260, height: 260, borderRadius: 130, backgroundColor: '#D9E0D2', position: 'absolute', top: -56, right: -64 },
  bagFrame: { position: 'absolute', top: '7%', right: '6%', aspectRatio: 1200 / 1450, maxWidth: '67%', height: '86%', borderRadius: 24, overflow: 'hidden', transform: [{ rotate: '6deg' }], backgroundColor: palette.canvasDeep },
  packingLabel: { position: 'absolute', left: 20, top: 24, gap: 12 },
  tinyRule: { width: 24, height: 2, backgroundColor: palette.pine },
  packingLabelText: { color: palette.pine, fontFamily: typography.medium, fontSize: 9, lineHeight: 16, letterSpacing: 1.6 },
  checklist: { position: 'absolute', bottom: 20, left: 16, minWidth: '53%', maxWidth: '70%', backgroundColor: palette.canvas, borderWidth: 1, borderColor: 'rgba(21,62,53,0.06)', borderRadius: 16, padding: 16, transform: [{ rotate: '-3deg' }] },
  compactChecklist: { bottom: 12, padding: 12 },
  listEyebrow: { fontFamily: typography.medium, fontSize: 8, letterSpacing: 1.4, color: palette.muted, marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  checkCircle: { height: 16, width: 16, borderRadius: 8, backgroundColor: palette.sage, justifyContent: 'center', alignItems: 'center' },
  listText: { fontFamily: typography.sans, fontSize: 12, color: palette.ink },
  listRule: { height: 3, borderRadius: 2, backgroundColor: palette.canvasDeep, marginTop: 16 },
  listProgress: { height: 3, borderRadius: 2, width: '76%', backgroundColor: palette.champagne },
  listFoot: { fontFamily: typography.sans, fontSize: 9, marginTop: 8, color: palette.muted },
  coastHalo: { position: 'absolute', top: 0, bottom: 8, left: '8%', right: '4%', borderRadius: 200, borderWidth: 1, borderColor: palette.champagne, transform: [{ rotate: '8deg' }] },
  coastInnerHalo: { position: 'absolute', top: 16, bottom: 16, left: '4%', right: '8%', borderRadius: 200, backgroundColor: palette.sage, transform: [{ rotate: '-6deg' }] },
  coastPhoto: { position: 'absolute', top: 8, bottom: 24, left: '9%', right: '9%', borderRadius: 200, overflow: 'hidden', backgroundColor: palette.sage },
  readySeal: { position: 'absolute', bottom: 24, right: '4%', width: 80, height: 80, borderRadius: 40, backgroundColor: palette.champagne, borderColor: palette.canvas, borderWidth: 5, justifyContent: 'center', alignItems: 'center', gap: 4, transform: [{ rotate: '8deg' }] },
  compactSeal: { width: 64, height: 64, borderRadius: 32, borderWidth: 4 },
  sealText: { fontFamily: typography.medium, fontSize: 8, color: palette.pine, letterSpacing: 1.5 },
  coastCaption: { position: 'absolute', bottom: 0, left: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  coastCaptionText: { fontFamily: typography.medium, color: palette.pine, fontSize: 8, letterSpacing: 1.6 },
  captionStar: { fontSize: 24, color: palette.pine },
  copy: { width: '100%' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  rule: { width: 24, height: 1, backgroundColor: palette.champagne },
  eyebrow: { fontFamily: typography.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, color: palette.pine, flexShrink: 1 },
  headline: { fontFamily: typography.editorial, fontSize: 46, lineHeight: 54, letterSpacing: -1.1, color: palette.ink },
  description: { fontFamily: typography.sans, fontSize: 16, lineHeight: 24, color: palette.muted, marginTop: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8, backgroundColor: palette.canvas, borderTopWidth: 1, borderTopColor: '#E9E9E1' },
  progressRow: { minHeight: 48, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backSlot: { flex: 1, minWidth: 72 },
  backButton: { minWidth: 80, minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  backLabel: { fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.pine },
  stepNumber: { flex: 1, textAlign: 'right', fontFamily: typography.medium, fontSize: 11, letterSpacing: 0.8, color: palette.pine },
  stepTotal: { color: palette.muted },
  indicators: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  indicator: { height: 4, borderRadius: 2, backgroundColor: '#D6DACE' },
  indicatorActive: { backgroundColor: palette.pine },
  buttonShadow: { borderRadius: 20, boxShadow: '0 6px 16px rgba(21,62,53,0.08)' },
  primary: { minHeight: 64, borderRadius: 20, backgroundColor: palette.pine, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  primaryArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,249,246,0.08)' },
  primaryDisabled: { opacity: 0.6 },
  primaryPressed: { backgroundColor: '#235246' },
  primaryLabel: { flexShrink: 1, color: palette.canvas, fontFamily: typography.medium, fontSize: 16, lineHeight: 24 },
  footerNote: { fontFamily: typography.sans, color: palette.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingTop: 16 },
  pressed: { opacity: 0.6 },
  error: { color: palette.danger, fontFamily: typography.sans, fontSize: 13, lineHeight: 20, paddingTop: 8 },
  completion: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, gap: 32, justifyContent: 'space-between' },
  completionHero: { width: '100%' },
  completionNote: { alignItems: 'center', paddingBottom: 16 },
});









