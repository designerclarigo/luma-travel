import { Text } from '@/components/language-provider';
import { View } from 'react-native';
import { palette } from '@/constants/waylo';
import { ui } from './travel-ui';
import { type DestinationMapProps } from './destination-map';
export default function DestinationMap({ place }: DestinationMapProps) { return <View style={{ minHeight: 160, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: palette.sage, borderRadius: 24 }}><Text style={ui.label}>{place.name} · {place.country}</Text><Text style={ui.body}>Native maps are available in supported mobile builds. Open any result in your maps app from this preview.</Text><Text style={ui.small}>{place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}° · {place.timezone}</Text></View>; }
