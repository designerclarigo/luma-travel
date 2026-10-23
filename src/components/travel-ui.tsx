import { Text, useLanguage } from '@/components/language-provider';
import { Image } from 'expo-image';
import { router, useSegments } from 'expo-router';
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable as NativePressable, ScrollView, StyleSheet, useWindowDimensions, type ViewStyle, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LaunchIssue, useWayloLaunch } from '@/components/waylo-launch';
import { useTravel } from '@/components/travel-provider';
import { motion, palette, typography } from '@/constants/waylo';
import { MotionPressable as Pressable } from '@/components/motion-pressable';
import { useFeedback } from '@/hooks/use-feedback';
import { shouldDismissSheet } from '@/lib/interface-policy';

export type IconName = 'explore' | 'saved' | 'trips' | 'profile' | 'bell' | 'pin' | 'search' | 'filter' | 'arrow' | 'back' | 'close' | 'star' | 'check' | 'plus' | 'calendar' | 'beach' | 'mountain' | 'city' | 'leaf' | 'edit' | 'chevron' | 'globe' | 'shield' | 'help' | 'backup' | 'replay' | 'template' | 'cloud';
const paths: Record<IconName, string> = {
  explore: 'm15.5 8.5-2 5-5 2 2-5 5-2Z M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  saved: 'M6 4h12v17l-6-4-6 4V4Z', trips: 'M8 6V4h8v2 M5 7h14a1 1 0 0 1 1 1v11H4V8a1 1 0 0 1 1-1Z M8 7v12 M16 7v12',
  profile: 'M5 21v-2a7 7 0 0 1 14 0v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Z M10 21h4 M12 2v2',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z M16 16l5 5',
  filter: 'M4 7h6 M14 7h6 M4 17h10 M18 17h2 M10 4v6 M14 14v6',
  arrow: 'M4 12h16 M14 6l6 6-6 6', back: 'M20 12H4 M10 6l-6 6 6 6', close: 'm6 6 12 12 M18 6 6 18',
  star: 'm12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.7l6.4-.9L12 3Z',
  check: 'm5 12 4 4L19 6', plus: 'M12 5v14 M5 12h14', calendar: 'M5 5h14v16H5V5Z M8 2v6 M16 2v6 M5 11h14',
  beach: 'M3 13a9 9 0 0 1 18 0H3Z M12 4v16 M8 21h8 M7 13c0-5 2-9 5-9s5 4 5 9',
  mountain: 'm2 20 8-15 5 9 3-5 5 11H2Z M7 11l3 2 2-1', city: 'M3 21V8h7v13 M10 21V3h10v18 M1 21h22 M6 11v1 M6 16v1 M14 7h2 M14 11h2 M14 15h2',
  leaf: 'M20 3C7 2 2 10 6 16s14 1 14-13Z M4 21 15 10',
  edit: 'm15 4 5 5 M4 20l5-1L21 7l-4-4L5 15l-1 5Z', chevron: 'm9 5 7 7-7 7',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z m-4 9 3 3 5-6',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.7-1.7 1.2-1.7 2.7 M12 17h.01',
  backup: 'M12 16V4 m-4 4 4-4 4 4 M4 14v6h16v-6', replay: 'M4 10a8 8 0 1 1 1 8 M4 4v6h6',
  template: 'M8 3h8v4H8V3Z M8 5H5v16h14V5h-3 M8 11h8 M8 15h8 M8 18h5',
  cloud: 'M6 18a5 5 0 1 1 0-10 6 6 0 0 1 11.5-1A5.5 5.5 0 0 1 18 18H6Z',
};
export function Icon({ name, size = 22, color = palette.pine, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={true} focusable={false}>
    <Path d={paths[name]} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function ActionButton({ children, onPress, secondary = false, busy = false, disabled = false, label, destructive = false }: PropsWithChildren<{ onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean; label?: string; destructive?: boolean }>) {
  const { t } = useLanguage();
  return <Pressable accessibilityRole="button" accessibilityLabel={label ? t(label) : undefined}
    aria-disabled={disabled || busy} aria-busy={busy} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={[ui.button, secondary && ui.secondary, destructive && { backgroundColor: palette.danger }]}>
    <Text style={[ui.buttonLabel, secondary && { color: palette.pine }]}>{children}</Text>
    {busy ? <ActivityIndicator color={secondary && !destructive ? palette.pine : palette.canvas} /> : <Icon name="arrow" size={18} color={destructive ? palette.canvas : secondary ? palette.pine : palette.champagne} />}
  </Pressable>;
}

export function IconButton({ name, label, onPress, filled = false, style, disabled = false }: { name: IconName; label: string; onPress: () => void; filled?: boolean; style?: ViewStyle; disabled?: boolean }) {
  const { t } = useLanguage(); return <Pressable accessibilityRole="button" accessibilityLabel={t(label)} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={[ui.iconButton, style]}><Icon name={name} filled={filled} /></Pressable>;
}

export function Screen({ children, scroll = false }: PropsWithChildren<{ scroll?: boolean }>) {
  const segments = useSegments();
  return <SafeAreaView style={ui.safe} edges={segments[0] === '(main)' ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior="padding" style={{ flex: 1 }}>
      {scroll ? <ScrollView contentInsetAdjustmentBehavior="never" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={ui.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[ui.screenContent, { flex: 1, minHeight: 0 }]}>{children}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function TravelGate({ children }: PropsWithChildren) {
  const travel = useTravel(); const launch = useWayloLaunch();
  if (launch.error) return <LaunchIssue />;
  if (!launch.ready) return <View style={{ flex: 1, backgroundColor: palette.pine }} />;
  if (travel.loading) return <Screen><View style={{ padding: 24, gap: 24 }} accessibilityLabel="Loading your travel inspiration" accessibilityState={{ busy: true }}>
    <View style={[ui.skeleton, { width: '60%', height: 48 }]} /><View style={[ui.skeleton, { height: 96 }]} /><View style={[ui.skeleton, { height: 56 }]} /><View style={[ui.skeleton, { height: 280 }]} />
  </View></Screen>;
  if (travel.error || !travel.data) return <Screen scroll><StatePanel icon="trips" title="A little pause." body="We couldn’t read your saved travel details. Try again to pick up where you left off." action="Try again" onAction={travel.retry} /></Screen>;
  return <>{children}</>;
}

export function StatePanel({ icon = 'explore', title, body, action, onAction }: { icon?: IconName; title: string; body: string; action: string; onAction: () => void }) {
  return <View style={ui.statePanel}><View style={ui.stateIcon}><Icon name={icon} size={32} /></View><Text accessibilityRole="header" style={ui.stateTitle}>{title}</Text><Text style={ui.body}>{body}</Text><ActionButton onPress={onAction}>{action}</ActionButton></View>;
}

export function Photo({ source, position = 'center', style }: { source: number; position?: 'center' | 'top' | 'bottom'; style?: ViewStyle }) {
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  return <View style={[{ overflow: 'hidden', backgroundColor: palette.sage }, style]}>
    {!failed ? <Image key={attempt} source={source} contentFit="cover" contentPosition={position} transition={0} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} accessible={false} /> :
      <Pressable accessibilityRole="button" accessibilityLabel="Retry destination photograph" style={ui.photoError} onPress={(event) => { event.stopPropagation(); setFailed(false); setAttempt((value) => value + 1); }}><Icon name="mountain" size={28} /><Text style={ui.small}>Tap to reload photo</Text></Pressable>}
  </View>;
}

export function Bookmark({ id, name, dark = false }: { id: string; name: string; dark?: boolean }) {
  const { data, update } = useTravel(); const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const locked = useRef(false);
  const notify = useFeedback();
  const saved = data?.saved.includes(id) ?? false;
  const toggle = async () => {
    if (locked.current) return; locked.current = true; setBusy(true); setError(false);
    try { await update((value) => ({ ...value, saved: value.saved.includes(id) ? value.saved.filter((item) => item !== id) : [...value.saved, id] })); notify(); }
    catch { setError(true); } finally { locked.current = false; setBusy(false); }
  };
  return <View style={ui.bookmarkWrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${saved ? 'Unsave' : 'Save'} ${name}`} accessibilityState={{ selected: saved, busy, disabled: busy }} disabled={busy} onPress={() => void toggle()}
      style={({ pressed }) => [ui.bookmark, dark && { backgroundColor: palette.canvasDeep }, pressed && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator size="small" color={palette.pine} /> : <Icon name="saved" size={19} filled={saved} />}
    </Pressable>
    {error && <Text accessibilityRole="alert" style={ui.bookmarkError}>Couldn’t save. Try again.</Text>}
  </View>;
}

export function Sheet({ title, visible, onClose, children }: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void }>) {
  const { reducedMotion } = useWayloLaunch(); const insets = useSafeAreaInsets(); const { height } = useWindowDimensions(); const { t } = useLanguage();
  const drag = useSharedValue(0);
  const [snapshot, setSnapshot] = useState({ title, children });
  // Retain the last content while the native modal fades out, avoiding an empty closing sheet.
  if (visible && (snapshot.title !== title || snapshot.children !== children)) setSnapshot({ title, children });
  useEffect(() => { if (visible) { drag.set(reducedMotion ? 0 : 24); if (!reducedMotion) drag.set(withSpring(0, motion.sheet)); } }, [drag, reducedMotion, visible]);
  const requestDismiss = () => { Keyboard.dismiss(); onClose(); };
  const pan = Gesture.Pan().activeOffsetY(8).failOffsetX([-24, 24]).onUpdate((event) => { drag.set(Math.max(0, event.translationY)); })
    .onEnd((event) => { if (shouldDismissSheet(event.translationY, event.velocityY)) scheduleOnRN(requestDismiss); drag.set(reducedMotion ? 0 : withSpring(0, motion.sheet)); })
    .onFinalize((_event, success) => { if (!success) drag.set(reducedMotion ? 0 : withSpring(0, motion.sheet)); });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const shown = visible ? { title, children } : snapshot;
  return <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={requestDismiss} statusBarTranslucent>
    <GestureHandlerRootView style={{ flex: 1 }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.modal}>
      <NativePressable accessibilityLabel={t('Dismiss dialog')} accessibilityRole="button" style={ui.backdrop} onPress={requestDismiss} />
      <Animated.View style={[ui.sheet, { maxHeight: Math.min(height * 0.92, height - insets.top - 8) }, animated]} accessibilityViewIsModal>
        <GestureDetector gesture={pan}><View><View style={ui.grabArea} pointerEvents="none"><View style={ui.grabber} /></View><View style={ui.sheetHeader}><Text accessibilityRole="header" style={ui.sheetTitle}>{shown.title}</Text><IconButton name="close" label="Close dialog" onPress={requestDismiss} /></View></View></GestureDetector>
        <ScrollView style={{ flexShrink: 1 }} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: Math.max(insets.bottom, 24), gap: 24 }}>{shown.children}</ScrollView>
      </Animated.View>
    </KeyboardAvoidingView></GestureHandlerRootView>
  </Modal>;
}

export function PageHeading({ title, subtitle, back = false, onBack }: { title: string; subtitle?: string; back?: boolean; onBack?: () => void }) {
  const { t } = useLanguage();
  return <View style={ui.pageHeading}>{back && <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={onBack ?? (() => { if (router.canGoBack()) router.back(); else router.replace('/home'); })} style={ui.backAction}><Icon name="back" size={20} /><Text style={ui.backLabel}>Back</Text></Pressable>}
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={ui.pageTitle}>{title}</Text>{subtitle && <Text style={ui.body}>{subtitle}</Text>}</View></View>;
}

export function WayloMotif() {
  return <Svg width={88} height={80} viewBox="0 0 88 80"><Circle cx={52} cy={40} r={30} stroke={palette.champagne} strokeOpacity={0.45} fill="none" /><Path d="M0 58c32-38 60-22 44-6-18 14-28-12 14-36" stroke={palette.champagne} strokeWidth={1.5} fill="none" /><Path d="m51 17 16-8-6 17-3-9-7 0Z" fill={palette.champagne} /><Rect x={0} y={0} width={88} height={80} fill="none" /></Svg>;
}

export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, screenContent: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 24 },
  body: { fontFamily: typography.sans, fontSize: 17, lineHeight: 26, color: palette.muted }, small: { fontFamily: typography.sans, fontSize: 13, lineHeight: 20, color: palette.muted },
  label: { fontFamily: typography.medium, fontSize: 16, lineHeight: 24, color: palette.ink }, input: { minHeight: 56, borderWidth: 1, borderColor: palette.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, fontFamily: typography.sans, fontSize: 17, lineHeight: 24, color: palette.ink, backgroundColor: palette.white },
  button: { minHeight: 56, padding: 16, borderRadius: 16, backgroundColor: palette.pine, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  buttonLabel: { flex: 1, fontFamily: typography.medium, fontSize: 16, lineHeight: 24, color: palette.canvas }, secondary: { backgroundColor: palette.sage },
  iconButton: { width: 48, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border },
  skeleton: { borderRadius: 24, backgroundColor: palette.canvasDeep }, statePanel: { padding: 24, gap: 24, marginVertical: 16 }, stateIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.sage, justifyContent: 'center', alignItems: 'center' },
  stateTitle: { fontFamily: typography.editorial, fontSize: 32, lineHeight: 38, color: palette.ink }, photoError: { flex: 1, minHeight: 80, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookmarkWrap: { position: 'absolute', right: 16, top: 16 }, bookmark: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(250,249,246,0.96)' },
  bookmarkError: { position: 'absolute', right: 0, top: 48, width: 160, backgroundColor: palette.canvas, color: palette.danger, fontFamily: typography.sans, fontSize: 12, padding: 8, borderRadius: 8 },
  modal: { flex: 1, justifyContent: 'flex-end' }, backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24,33,30,0.36)' }, sheet: { width: '100%', maxWidth: 640, alignSelf: 'center', borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: palette.canvas, overflow: 'hidden' },
  grabArea: { height: 24, alignItems: 'center', justifyContent: 'center' }, grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border },
  sheetHeader: { paddingHorizontal: 24, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 16 }, sheetTitle: { flex: 1, fontFamily: typography.editorial, fontSize: 32, lineHeight: 38, color: palette.ink },
  pageHeading: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 16 }, backAction: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16, borderRadius: 16 }, backLabel: { fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.pine },
  pageTitle: { fontFamily: typography.editorial, fontSize: 38, lineHeight: 42, letterSpacing: -0.6, color: palette.ink }, error: { fontFamily: typography.sans, fontSize: 14, lineHeight: 22, color: palette.danger },
});
