import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useTravel } from '@/components/travel-provider';
import { useWayloLaunch } from '@/components/waylo-launch';

let lastFeedback = 0;
/** Optional native feedback never blocks an action or substitutes for visible confirmation. */
export function useFeedback() {
  const { data } = useTravel(); const { reducedMotion } = useWayloLaunch();
  return (kind: 'selection' | 'success' = 'selection') => {
    if (Platform.OS === 'web' || reducedMotion || data?.settings.hapticsEnabled === false || Date.now() - lastFeedback < 100) return;
    lastFeedback = Date.now();
    const response = Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(kind === 'success' ? Haptics.AndroidHaptics.Confirm : Haptics.AndroidHaptics.Segment_Tick)
      : kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync();
    void response.catch(() => { /* Unsupported or disabled device feedback leaves the action intact. */ });
  };
}
