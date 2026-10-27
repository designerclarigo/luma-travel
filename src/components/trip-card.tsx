import { useCurrency } from './currency-provider';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from './language-provider';
import { MotionPressable } from './motion-pressable';
import { Icon, Photo, ui } from './travel-ui';
import { destinationById } from '@/constants/destinations';
import { palette, typography } from '@/constants/waylo';
import { type Place } from '@/lib/journey-types';
import { tripPlaces, tripStatus } from '@/lib/trip-summary';
import { dateLabel, type Trip } from '@/lib/travel-state';

export function TripCard({ trip, places }: { trip: Trip; places: Place[] }) {
  const money = useCurrency();
  const { width, fontScale } = useWindowDimensions(); const roomyText = fontScale > 1.2;
  const locations = tripPlaces(trip, places); const photo = destinationById(trip.destinationId);
  const names = locations.map((p) => p.name).join(' & ') || 'Your destinations'; const status = tripStatus(trip);
  const thumbnail = width < 360 ? 64 : 80;
  return <MotionPressable accessibilityRole="button" accessibilityLabel={`Open ${trip.title}. ${names}. ${dateLabel(trip.departure)} to ${dateLabel(trip.endDate)}. ${status}.`} onPress={() => router.push({ pathname: '/trip', params: { id: trip.id } })} style={s.card}>
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      {!roomyText && (photo ? <Photo source={photo.image} position={photo.id === 'bali' ? 'top' : 'center'} style={{ width: thumbnail, height: thumbnail + 16, borderRadius: 16 }} /> : <View style={[s.placeholder, { width: thumbnail, height: thumbnail + 16 }]}><Icon name={locations[0]?.kind === 'country' ? 'globe' : 'pin'} size={28} /><Text style={s.country}>{locations[0]?.countryCode ?? 'GO'}</Text></View>)}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text accessibilityRole="header" style={s.title}>{trip.title}</Text>
        <Text style={s.destination}>{names}</Text>
        <Text style={ui.small}>{locations.length === 1 ? locations[0].kind === 'country' ? 'Country reference point' : [locations[0].region?.split(' · ')[0], locations[0].country].filter(Boolean).join(', ') : [...new Set(locations.map((p) => p.country))].join(' · ')}</Text>
      </View>
    </View>
    <View style={s.bottom}>
      <View style={{ flex: 1, minWidth: 120, gap: 4 }}><Text style={s.date}>{dateLabel(trip.departure)} – {dateLabel(trip.endDate)}</Text><Text style={s.detail}>{trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'} · {money.format(trip.budget)} budget</Text></View>
      <View style={[s.badge, status === 'In progress' && { backgroundColor: palette.pine }]}><Text style={[s.badgeText, status === 'In progress' && { color: palette.canvas }]}>{status}</Text></View>
    </View>
  </MotionPressable>;
}
const s = StyleSheet.create({
  card: { padding: 16, gap: 16, backgroundColor: palette.white, borderRadius: 24, borderWidth: 1, borderColor: palette.border, boxShadow: '0 4px 20px rgba(21,62,53,0.035)' },
  title: { fontFamily: typography.editorial, fontSize: 25, lineHeight: 29, color: palette.ink },
  destination: { fontFamily: typography.medium, fontSize: 14, lineHeight: 21, color: palette.pine },
  placeholder: { backgroundColor: palette.sage, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  country: { fontFamily: typography.medium, fontSize: 11, color: palette.pine, letterSpacing: 2 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, paddingTop: 12 },
  date: { fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.ink },
  detail: { fontFamily: typography.sans, fontSize: 12, lineHeight: 18, color: palette.muted },
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: palette.sage, maxWidth: '100%' },
  badgeText: { fontFamily: typography.medium, fontSize: 11, lineHeight: 16, color: palette.pine },
});
