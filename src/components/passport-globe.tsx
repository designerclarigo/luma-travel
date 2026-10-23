import { Text } from '@/components/language-provider';
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { useEffect, useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import world from '@/constants/data/world.json';
import { palette } from '@/constants/waylo';
import { type CountryRecord } from '@/lib/journey-types';
import { j, TextAction } from './journey-ui';
import { ui } from './travel-ui';

class GlobeGesture {
  angle: [number, number] = [-20, -15]; origin: [number, number] = [-20, -15];
  private frame: number | null = null;
  constructor(private changed: (rotation: [number, number]) => void) {}
  private publish = () => { if (this.frame === null) this.frame = requestAnimationFrame(() => { this.frame = null; this.changed([...this.angle]); }); };
  responder = PanResponder.create({ onStartShouldSetPanResponder: () => false, onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2, onPanResponderGrant: () => { this.origin = [...this.angle]; }, onPanResponderMove: (_, g) => { this.angle = [this.origin[0] + g.dx * 0.5, Math.max(-70, Math.min(70, this.origin[1] - g.dy * 0.35))]; this.publish(); }, onPanResponderTerminationRequest: () => true });
  turn(amount: number) { this.angle = [this.angle[0] + amount, this.angle[1]]; this.changed(this.angle); }
  dispose() { if (this.frame !== null) cancelAnimationFrame(this.frame); }
}
const graticule = geoGraticule10();
export function PassportGlobe({ records, onSelect }: { records: CountryRecord[]; onSelect: (code: string) => void }) {
  const [rotation, setRotation] = useState<[number, number]>([-20, -15]); const [gesture] = useState(() => new GlobeGesture(setRotation)); const [size, setSize] = useState(300); const drag = gesture.responder;
  useEffect(() => () => gesture.dispose(), [gesture]);
  const geometry = useMemo(() => { const projection = geoOrthographic().translate([size / 2, size / 2]).scale(size * 0.46).rotate([rotation[0], rotation[1], 0]).clipAngle(90); const path = geoPath(projection); return { grid: path(graticule) ?? '', countries: world.features.map((feature) => path(feature as never) ?? '') }; }, [rotation, size]);
  const countries = useMemo(() => new Map(records.map((record) => [record.code, record])), [records]);
  return <View style={{ gap: 8 }}><View onLayout={(e) => { const next = Math.min(440, e.nativeEvent.layout.width); if (next > 0) setSize(next); }} style={{ alignItems: 'center', backgroundColor: palette.pine, borderRadius: 28, paddingVertical: 8 }} {...drag.panHandlers}><Svg width={size} height={size} accessibilityLabel="Travel globe. Use the country list below to select places." accessibilityRole="image"><Circle cx={size / 2} cy={size / 2} r={size * 0.46} fill="#244D42" stroke="#668071" strokeWidth={0.8} /><Path d={geometry.grid} stroke="#4B6B5E" fill="none" strokeWidth={0.35} />{world.features.map((feature, index) => { const record = countries.get(feature.properties.code); return <Path key={`${feature.properties.code}-${index}`} d={geometry.countries[index]} fill={record?.status === 'visited' ? palette.champagne : record?.status === 'wishlist' ? '#B6C9B9' : '#638075'} stroke="#244D42" strokeWidth={0.45} onPress={() => feature.properties.code.length === 2 && onSelect(feature.properties.code)} />; })}</Svg></View><View style={j.between}><TextAction label="Rotate west" onPress={() => gesture.turn(35)} /><TextAction label="Rotate east" onPress={() => gesture.turn(-35)} /></View><Text style={ui.small}>Gold: visited · Sage: wishlist. Drag to turn. Simplified Natural Earth boundaries; small territories remain available in the full country list.</Text></View>;
}
