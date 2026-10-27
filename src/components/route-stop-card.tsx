import { StyleSheet, View } from 'react-native';
import { Text } from './language-provider';
import { MotionPressable } from './motion-pressable';
import { Icon, ui } from './travel-ui';
import { DatePicker } from './date-picker';
import { j, TextAction } from './journey-ui';
import { palette, typography } from '@/constants/waylo';
import { type Stop } from '@/lib/journey-types';
import { dateLabel } from '@/lib/dates';
import { stopNights } from '@/lib/route-planning';

export function RouteStopCard({ stop, index, total, expanded, warnings, locked, reorderDisabled, onToggle, onMove, onChange, onRemove, onDiscover, onMap }: { stop: Stop; index: number; total: number; expanded: boolean; warnings: string[]; locked: boolean; reorderDisabled: boolean; onToggle: () => void; onMove: (delta: number) => void; onChange: (patch: Partial<Stop>) => void; onRemove: () => void; onDiscover: () => void; onMap: () => void }) {
  const nights = stopNights(stop);
  return <View style={s.timelineRow}>
    <View style={s.rail}><View accessibilityLabel={`Stop ${index + 1}`} style={s.number}><Text style={s.numberText}>{index + 1}</Text></View>{index < total - 1 && <View style={s.connector} />}</View>
    <View style={[s.card, warnings.length > 0 && { borderColor: palette.danger }]}>
      <MotionPressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Edit'} stop ${index + 1}: ${stop.place.name}`} accessibilityState={{ expanded }} onPress={onToggle} style={s.header}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={j.kicker}>{stop.place.countryCode} · {nights} {nights === 1 ? 'NIGHT' : 'NIGHTS'}</Text><Text localize={false} style={s.name}>{stop.place.name}</Text><Text localize={false} style={ui.small}>{[stop.place.region?.split(' · ')[0], stop.place.country].filter(Boolean).join(', ')}</Text></View><View style={{ transform: [{ rotate: expanded ? '270deg' : '90deg' }] }}><Icon name="chevron" size={16} /></View>
      </MotionPressable>
      <Text style={s.dates}>{dateLabel(stop.arrival)} – {dateLabel(stop.departure)}{nights === 0 ? '\nDay stop' : ''}</Text>
      {warnings.map((message) => <Text key={message} accessibilityLiveRegion="polite" style={s.warning}>{message}</Text>)}
      {total > 1 && <View style={s.moves}>{[-1, 1].map((delta) => { const disabled = locked || reorderDisabled || index + delta < 0 || index + delta >= total; return <MotionPressable key={delta} accessibilityRole="button" accessibilityLabel={`Move ${stop.place.name} ${delta < 0 ? 'up' : 'down'}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onMove(delta)} style={[s.move, disabled && { opacity: 0.35 }]}><View style={{ transform: [{ rotate: delta < 0 ? '-90deg' : '90deg' }] }}><Icon name="arrow" size={14} /></View><Text style={s.moveLabel}>{delta < 0 ? 'Move up' : 'Move down'}</Text></MotionPressable>; })}</View>}
      {expanded && <View style={s.editor}><DatePicker label={`First day in ${stop.place.name}`} value={stop.arrival} onChange={(arrival) => onChange({ arrival })} /><DatePicker label={`Last day in ${stop.place.name}`} value={stop.departure} minimum={stop.arrival} onChange={(departure) => onChange({ departure })} /><Text style={ui.small}>A night is the time between these dates. Two destinations may share a travel day.</Text><View style={j.wrap}><TextAction label={`Discover ${stop.place.name}`} onPress={onDiscover} disabled={locked} /><TextAction label={`Open map for ${stop.place.name}`} onPress={onMap} /><TextAction danger label={`Remove stop ${index + 1}`} onPress={onRemove} disabled={locked} /></View></View>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  timelineRow: { flexDirection: 'row', gap: 12 }, rail: { width: 32, alignItems: 'center' },
  number: { width: 32, minHeight: 32, paddingVertical: 6, borderRadius: 24, marginTop: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.pine }, numberText: { fontFamily: typography.medium, color: palette.canvas, fontSize: 14, lineHeight: 20 },
  connector: { position: 'absolute', width: 1, top: 56, bottom: -8, backgroundColor: palette.border },
  card: { flex: 1, minWidth: 0, padding: 16, gap: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 24, backgroundColor: palette.white },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 }, name: { fontFamily: typography.editorial, fontSize: 26, lineHeight: 30, color: palette.ink },
  dates: { fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.ink }, warning: { color: palette.danger, fontFamily: typography.sans, fontSize: 13, lineHeight: 20 },
  moves: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  move: { flexGrow: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2 }, moveLabel: { fontFamily: typography.medium, fontSize: 12, color: palette.pine, lineHeight: 18 },
  editor: { gap: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
});
