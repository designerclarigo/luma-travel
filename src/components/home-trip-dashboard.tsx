import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from './language-provider';
import { useTravel } from './travel-provider';
import { ActionButton, Icon, ui } from './travel-ui';
import { TextAction } from './journey-ui';
import { palette, typography } from '@/constants/waylo';
import { useCurrentDate } from '@/hooks/use-current-date';
import { departureCountdown, nextDashboardTrip } from '@/lib/home-dashboard';
import { packingProgress } from '@/lib/packing-engine';
import { dateLabel } from '@/lib/dates';
import { tripPlaces } from '@/lib/trip-summary';

export function HomeTripDashboard({ gutter }: { gutter: number }) {
  const { data } = useTravel(); const today = useCurrentDate();
  const trip = nextDashboardTrip(data!.trips, today);
  if (!trip) return <View style={[s.empty, { marginHorizontal: gutter }]}><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={s.emptyTitle}>{data!.trips.length ? 'Room for another story.' : 'Your next chapter starts here.'}</Text><Text style={ui.small}>No upcoming trip yet. Make a little plan.</Text></View><TextAction icon="plus" label="Plan a trip" onPress={() => router.push('/plan')} /></View>;
  const progress = packingProgress(trip.packing); const places = tripPlaces(trip, data!.customPlaces);
  return <View style={[s.card, { marginHorizontal: gutter }]}>
    <View style={s.top}><Text style={s.kicker}>{trip.departure <= today ? 'YOUR JOURNEY IS HERE' : 'YOUR NEXT ESCAPE'}</Text><View style={s.badge}><Text style={s.countdown}>{departureCountdown(trip, today)}</Text></View></View>
    <View style={{ gap: 8 }}><Text localize={false} numberOfLines={2} accessibilityRole="header" style={s.title}>{trip.title}</Text><Text localize={false} style={s.destinations}>{places.length ? places.map((p) => p.name).join(' · ') : 'Destination details unavailable'}</Text><View style={s.dateRow}><Icon name="calendar" color={palette.champagne} size={16} /><Text style={s.dates}>{dateLabel(trip.departure)} – {dateLabel(trip.endDate)}</Text></View></View>
    <View style={s.packing}><View style={s.top}><Text style={s.packingLabel}>Packing checklist</Text><Text style={s.packingCount}>{progress.total ? `${progress.packed} of ${progress.total} packed · ${progress.percent}%` : 'No items yet'}</Text></View>{progress.total > 0 && <View accessibilityRole="progressbar" accessibilityLabel={`Packing for ${trip.title}`} accessibilityValue={{ min: 0, max: progress.total, now: progress.packed }} style={s.track}><View style={[s.fill, { width: `${progress.percent}%` }]} /></View>}</View>
    <ActionButton secondary onPress={() => router.push({ pathname: '/plan', params: { id: trip.id } })}>Continue Planning</ActionButton>
    <View style={s.links}><TextAction label="Open packing checklist" onPress={() => router.push({ pathname: '/packing', params: { id: trip.id } })} /><TextAction label="Trip details" onPress={() => router.push({ pathname: '/trip', params: { id: trip.id } })} /></View>
  </View>;
}
const s = StyleSheet.create({
  card: { marginTop: 24, padding: 24, gap: 16, borderRadius: 24, backgroundColor: palette.pine, boxShadow: '0 8px 24px rgba(21,62,53,0.10)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  kicker: { fontFamily: typography.medium, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, color: palette.champagne },
  badge: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: palette.canvas, borderRadius: 16, maxWidth: '100%' },
  countdown: { fontFamily: typography.medium, fontSize: 12, lineHeight: 18, color: palette.pine },
  title: { fontFamily: typography.editorial, fontSize: 32, lineHeight: 36, color: palette.canvas },
  destinations: { fontFamily: typography.sans, fontSize: 14, lineHeight: 21, color: palette.canvas },
  dateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dates: { flex: 1, fontFamily: typography.sans, fontSize: 13, lineHeight: 20, color: palette.canvas },
  packing: { gap: 10, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(250,249,246,0.2)' },
  packingLabel: { fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.canvas },
  packingCount: { fontFamily: typography.sans, fontSize: 12, lineHeight: 18, color: palette.canvas },
  track: { height: 5, borderRadius: 4, backgroundColor: 'rgba(250,249,246,0.18)', overflow: 'hidden' }, fill: { height: 5, borderRadius: 4, backgroundColor: palette.champagne },
  links: { paddingHorizontal: 12, paddingVertical: 0, borderRadius: 16, backgroundColor: palette.canvas, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  empty: { marginTop: 24, padding: 16, gap: 12, borderRadius: 20, backgroundColor: palette.sage, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  emptyTitle: { fontFamily: typography.editorial, fontSize: 24, lineHeight: 28, color: palette.ink },
});
