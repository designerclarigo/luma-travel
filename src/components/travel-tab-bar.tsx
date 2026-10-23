import { MotionPressable as Pressable } from '@/components/motion-pressable';
import { Text, useLanguage } from '@/components/language-provider';
import { Tabs } from 'expo-router';
import { type ComponentProps, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/travel-ui';
import { palette, typography } from '@/constants/waylo';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useWayloLaunch } from './waylo-launch';

const tabs: Record<string, { label: string; icon: IconName }> = { home: { label: 'Explore', icon: 'explore' }, saved: { label: 'Saved', icon: 'saved' }, trips: { label: 'Trips', icon: 'trips' }, profile: { label: 'Profile', icon: 'profile' } };
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
export function TravelTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets(); const { t } = useLanguage();
  return <View style={[styles.bar, { paddingBottom: Math.max(8, insets.bottom), paddingLeft: insets.left, paddingRight: insets.right }]}><View style={styles.inner}>
    {state.routes.map((route, index) => { const tab = tabs[route.name]; if (!tab) return null; const active = state.index === index;
      return <TabItem key={route.key} tab={tab} label={t(tab.label)} active={active} onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!active && !event.defaultPrevented) navigation.navigate(route.name); }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} />;
    })}
  </View></View>;
}
function TabItem({ tab, label, active, onPress, onLongPress }: { tab: { label: string; icon: IconName }; label: string; active: boolean; onPress: () => void; onLongPress: () => void }) {
  const { reducedMotion } = useWayloLaunch(); const opacity = useSharedValue(active ? 1 : 0);
  useEffect(() => { opacity.set(reducedMotion ? Number(active) : withTiming(Number(active), { duration: 140 })); }, [active, opacity, reducedMotion]);
  const highlight = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} aria-selected={active} accessibilityState={{ selected: active }} feedback={!active} onPress={onPress} onLongPress={onLongPress} style={styles.tab}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.active, highlight]} />
    <Icon name={tab.icon} size={22} color={active ? palette.pine : palette.muted} filled={active && tab.icon === 'saved'} /><Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  bar: { backgroundColor: palette.canvas, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 8 }, inner: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  tab: { flex: 1, minHeight: 64, padding: 8, gap: 4, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, active: { backgroundColor: palette.sage, borderRadius: 20 }, label: { flexShrink: 1, textAlign: 'center', fontFamily: typography.sans, fontSize: 11, lineHeight: 16, color: palette.muted }, activeLabel: { fontFamily: typography.medium, color: palette.pine },
});
