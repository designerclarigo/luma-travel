import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { Text, useLanguage } from './language-provider';
import { MotionPressable } from './motion-pressable';
import { Icon, IconButton, ui } from './travel-ui';
import { TextAction } from './journey-ui';
import { palette, typography } from '@/constants/waylo';
import { type Place } from '@/lib/journey-types';
import { startPlaceSearch, type PlaceSearchState } from '@/lib/place-search';

export function LocationSearch({ query, onQuery, onSelect, onSubmit, enabled = true, selecting = false }: { query: string; onQuery: (value: string) => void; onSelect: (place: Place) => void; onSubmit?: () => void; enabled?: boolean; selecting?: boolean }) {
  const { language } = useLanguage(); const [retry, setRetry] = useState(0);
  const [state, setState] = useState<PlaceSearchState>({ query: '', status: 'idle', places: [], error: '' });
  useEffect(() => { if (enabled) return startPlaceSearch(query, language, setState); }, [query, language, enabled, retry]);
  const current = state.query === query.trim() ? state : { query: query.trim(), status: query.trim().length < 2 ? 'idle' : 'loading', places: [], error: '' };
  return <View style={{ gap: 16 }}>
    <View style={[ui.input, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0, paddingHorizontal: 16 }]}>
      <Icon name="search" size={20} /><TextInput accessibilityLabel="Search cities and countries" placeholder="City or country" placeholderTextColor={palette.muted} value={query} onChangeText={onQuery} autoCorrect={false} autoCapitalize="none" maxLength={100} returnKeyType="search" onSubmitEditing={() => { setRetry((n) => n + 1); onSubmit?.(); }} style={s.input} />
      {!!query && <IconButton name="close" label="Clear place search" onPress={() => onQuery('')} />}
    </View>
    <Text style={ui.small}>Search worldwide. Add a region or country for a closer match, like “Paris, France”.</Text>
    {current.status === 'loading' && <View accessibilityLiveRegion="polite" style={s.loading}><ActivityIndicator color={palette.pine} /><Text style={ui.small}>Finding matching places…</Text></View>}
    {current.status === 'error' && <View style={s.message}><Text accessibilityRole="alert" style={ui.error}>{current.error}</Text><TextAction label="Retry location search" onPress={() => setRetry((n) => n + 1)} /></View>}
    {current.status === 'success' && <>
      <Text accessibilityLiveRegion="polite" style={s.eyebrow}>{current.places.length ? 'WORLDWIDE RESULTS' : 'NO MATCHING PLACES'}</Text>
      {!current.places.length && <View style={s.message}><Text style={ui.label}>A different spelling, a new possibility.</Text><Text style={ui.small}>Try the city’s local name or add its full country name after a comma.</Text></View>}
      {!!current.places.length && <View style={s.results}>{current.places.map((place, index) => <MotionPressable key={place.id} accessibilityRole="button" accessibilityLabel={`Choose ${place.name}, ${place.region ? `${place.region}, ` : ''}${place.country}, ${place.kind ?? 'city'}, ${place.latitude.toFixed(3)}, ${place.longitude.toFixed(3)}`} accessibilityState={{ disabled: selecting }} disabled={selecting} onPress={() => onSelect(place)} style={[s.result, index > 0 && s.divider]}>
        <View style={s.pin}><Icon name={place.kind === 'country' ? 'globe' : 'pin'} size={20} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={s.name}>{place.name}</Text><Text style={ui.small}>{[place.region, place.country].filter(Boolean).join(', ')}</Text><Text style={s.meta}>{place.kind === 'country' ? 'Country · reference point' : place.kind === 'region' ? 'Region · reference point' : `${place.latitude.toFixed(3)}°, ${place.longitude.toFixed(3)}°`}</Text></View><Icon name="chevron" size={16} />
      </MotionPressable>)}</View>}
    </>}
    <Text style={s.meta}>Live location data: GeoNames via Open-Meteo. Your search text is sent to this provider. Saved places remain available offline.</Text>
  </View>;
}
const s = StyleSheet.create({
  input: { flex: 1, minWidth: 0, minHeight: 56, fontFamily: typography.sans, fontSize: 16, color: palette.ink },
  loading: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 16 },
  results: { borderRadius: 24, backgroundColor: palette.white, borderColor: palette.border, borderWidth: 1, overflow: 'hidden' },
  result: { minHeight: 88, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  pin: { width: 40, height: 40, borderRadius: 14, backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: typography.medium, color: palette.ink, fontSize: 17, lineHeight: 24 },
  meta: { fontFamily: typography.sans, fontSize: 12, lineHeight: 18, color: palette.muted },
  eyebrow: { fontFamily: typography.medium, fontSize: 11, lineHeight: 18, letterSpacing: 1.5, color: palette.pine },
  message: { gap: 8, padding: 16, backgroundColor: palette.sage, borderRadius: 16 },
});
