import { Text } from '@/components/language-provider';
import { Platform, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { type NearbyPlace, type Place } from '@/lib/journey-types';
import { palette } from '@/constants/waylo';
import { ui } from './travel-ui';
export type DestinationMapProps = { place: Place; points: NearbyPlace[]; onSelect: (point: NearbyPlace) => void };
export default function DestinationMap({ place, points, onSelect }: DestinationMapProps) {
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) return <View style={{ padding: 24, borderRadius: 24, backgroundColor: palette.sage }}><Text style={ui.body}>In-app Android maps need a configured Google Maps key and a rebuilt app. Every place below can open in your maps app.</Text></View>;
  return <View style={{ height: 280, borderRadius: 24, overflow: 'hidden' }}><MapView key={place.id} style={{ flex: 1 }} initialRegion={{ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.045, longitudeDelta: 0.045 }} showsUserLocation={false}><Marker coordinate={place} title={place.name} pinColor={palette.pine} />{points.map((point) => <Marker key={point.id} coordinate={point} title={point.name} pinColor="#AC8647" onPress={() => onSelect(point)} />)}</MapView></View>;
}
