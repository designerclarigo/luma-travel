import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/language-provider';
import { MotionPressable as Pressable } from '@/components/motion-pressable';
import { j } from '@/components/journey-ui';
import { Icon, IconButton, Sheet, ui } from '@/components/travel-ui';
import { palette } from '@/constants/waylo';
import { calendarColumns } from '@/lib/interface-policy';
import { dateLabel, localDate } from '@/lib/travel-state';

export function DatePicker({ label, value, onChange, minimum }: { label: string; value: string; onChange: (date: string) => void; minimum?: string }) {
  const [visible, setVisible] = useState(false); const [month, setMonth] = useState(value.slice(0, 7));
  const { width, fontScale } = useWindowDimensions(); const columns = calendarColumns(width, fontScale);
  const first = new Date(`${month}-01T12:00:00`); const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); const offset = columns === 7 ? (first.getDay() + 6) % 7 : 0;
  const shift = (amount: number) => { const next = new Date(first); next.setMonth(next.getMonth() + amount); setMonth(localDate(next).slice(0, 7)); };
  return <View style={j.field}><Text style={ui.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${dateLabel(value)}. Choose date`} onPress={() => { setMonth(value.slice(0, 7)); setVisible(true); }} style={[ui.input, j.between]}><Text style={ui.label}>{dateLabel(value)}</Text><Icon name="calendar" /></Pressable>
    <Sheet title={label} visible={visible} onClose={() => setVisible(false)}>
      <View style={j.row}><IconButton name="back" label="Previous month" onPress={() => shift(-1)} /><Text accessibilityLiveRegion="polite" style={[ui.label, { flex: 1, textAlign: 'center' }]}>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><IconButton name="arrow" label="Next month" onPress={() => shift(1)} /></View>
      {columns === 7 && <View style={{ flexDirection: 'row' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={index} style={[ui.small, { width: `${100 / 7}%`, textAlign: 'center' }]}>{day}</Text>)}</View>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: offset + days }, (_, index) => {
        const day = index - offset + 1; const date = `${month}-${String(day).padStart(2, '0')}`; const disabled = day < 1 || !!minimum && date < minimum;
        return day < 1 ? <View key={index} style={{ width: `${100 / columns}%` }} /> : <Pressable key={date} feedback accessibilityRole="button" accessibilityLabel={dateLabel(date)} accessibilityState={{ selected: value === date, disabled }} aria-selected={value === date} disabled={disabled}
          onPress={() => { onChange(date); setVisible(false); }} style={{ width: `${100 / columns}%`, minHeight: columns === 3 ? 72 : 48, padding: 8, gap: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: value === date ? palette.pine : 'transparent' }}>
          <Text style={[ui.label, value === date && { color: palette.canvas }]}>{day}</Text>{columns === 3 && <Text style={[ui.small, { textAlign: 'center' }, value === date && { color: palette.canvas }]}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</Text>}
        </Pressable>;
      })}</View><Text style={ui.small}>Select a day. Dates use your device’s local calendar.</Text>
    </Sheet>
  </View>;
}
