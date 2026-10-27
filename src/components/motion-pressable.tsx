import { type Ref, useEffect, useState } from 'react';
import { Pressable, type PressableProps, type ViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useWayloLaunch } from '@/components/waylo-launch';
import { motion } from '@/constants/waylo';
import { useFeedback } from '@/hooks/use-feedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Transforms run on the UI thread and do not change flex sizing or scroll geometry. */
export function MotionPressable({ style, onPressIn, onPressOut, onPress, onHoverIn, onHoverOut, disabled, feedback = false, ref, ...props }: PressableProps & { feedback?: boolean; ref?: Ref<ViewInstance> }) {
  const { reducedMotion } = useWayloLaunch(); const notify = useFeedback();
  const [pointerDown, setPointerDown] = useState(false); const pressed = pointerDown && !disabled;
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  useEffect(() => { if (reducedMotion || disabled) scale.set(1); }, [disabled, reducedMotion, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <AnimatedPressable {...props} ref={ref} disabled={disabled}
    onPress={(event) => { if (feedback) notify(); onPress?.(event); }}
    onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }} onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
    onPressIn={(event) => { setPointerDown(true); if (!reducedMotion) scale.set(withSpring(0.985, motion.press)); onPressIn?.(event); }}
    onPressOut={(event) => { setPointerDown(false); scale.set(reducedMotion ? 1 : withSpring(1, motion.press)); onPressOut?.(event); }}
    style={[typeof style === 'function' ? style({ pressed, hovered: hovered && !disabled }) : style, pressed && { opacity: 0.84 }, disabled && { opacity: 0.45 }, animated]} />;
}
