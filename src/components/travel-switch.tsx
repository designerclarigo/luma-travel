import { Platform, StyleSheet, Switch, type SwitchProps, View } from 'react-native';
import { useLanguage } from '@/components/language-provider';
import { palette } from '@/constants/waylo';
import { useFeedback } from '@/hooks/use-feedback';

const webColors = Platform.OS === 'web' ? { activeThumbColor: palette.canvas } : {};
export function TravelSwitch({ accessibilityLabel, onValueChange, ...props }: SwitchProps) {
  const { t } = useLanguage(); const notify = useFeedback();
  return <View style={styles.target}><Switch {...props} {...webColors} accessibilityLabel={accessibilityLabel ? t(accessibilityLabel) : undefined}
    hitSlop={12} trackColor={{ false: palette.border, true: palette.pine }} thumbColor={palette.canvas}
    onValueChange={(value) => { notify(); onValueChange?.(value); }} /></View>;
}
const styles = StyleSheet.create({ target: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center' } });
