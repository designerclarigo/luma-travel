import { Link, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { isRunningInExpoGo } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLiveActivity, createWidget } from 'expo-widgets';
import { packingProgress } from './packing-engine';
import { localDate, type TravelState, type Trip } from './travel-state';
type Snapshot = { tripId: string; title: string; packed: number; total: number; percent: number; date: string; remaining: string[]; updated: string };
const snapshot = (trip?: Trip): Snapshot => { const progress = packingProgress(trip?.packing ?? []); return { tripId: trip?.id ?? '', title: trip?.title ?? 'A new story awaits', packed: progress.packed, total: progress.total, percent: progress.percent, date: trip?.departure ?? '', remaining: trip?.packing.filter((p) => !p.packed).slice(0, 3).map((p) => p.label) ?? [], updated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }; };
const packing = !isRunningInExpoGo() ? createWidget<Snapshot>('WayloPacking', (props, environment) => {
  'widget';
  if (environment.widgetFamily === 'accessoryInline') return <Text>Waylo · {props.percent}% packed</Text>;
  return <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 8 }), containerBackground('#FAF9F6', 'widget')]}><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle('#153E35')]}>WAYLO · {props.date}</Text><Text modifiers={[font({ textStyle: 'title3', design: 'serif' }), foregroundStyle('#18211E')]}>{props.title}</Text><ProgressView value={props.percent / 100} /><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('#153E35')]}>{props.packed} / {props.total} packed · updated {props.updated}</Text>{environment.widgetFamily === 'systemLarge' && props.remaining.map((label, index) => <Text key={index} modifiers={[font({ textStyle: 'body' }), foregroundStyle('#18211E')]}>{label}</Text>)}<Link label="Open packing list" destination={props.tripId ? `waylo://packing?id=${props.tripId}` : 'waylo://trips'} /></VStack>;
}) : null;
const activity = !isRunningInExpoGo() ? createLiveActivity<Snapshot>('WayloReady', (props, environment) => {
  'widget';
  return { banner: <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}><Text modifiers={[font({ textStyle: 'headline' })]}>{props.title}</Text><ProgressView value={props.percent / 100} /><Text>{props.packed} / {props.total} packed{environment.isStale ? ' · Open Waylo to refresh' : ` · updated ${props.updated}`}</Text></VStack>, compactLeading: <Text>W</Text>, compactTrailing: <Text>{props.percent}%</Text>, minimal: <Text>{props.percent}%</Text>, expandedCenter: <Text>{props.title}</Text>, expandedBottom: <Text>{props.packed} / {props.total} packed · Open Waylo to update</Text> };
}) : null;
export const widgetAvailable = !isRunningInExpoGo();
async function applyPackingWidget(state: TravelState) { if (!packing) return; const trip = [...state.trips].filter((t) => !t.completedAt && t.endDate >= localDate()).sort((a, b) => a.departure.localeCompare(b.departure))[0]; packing.updateSnapshot(snapshot(state.settings.widgetsEnabled ? trip : undefined)); const activeId = await AsyncStorage.getItem('@waylo/device/live-trip'); for (const instance of activity?.getInstances() ?? []) { const active = state.trips.find((t) => t.id === activeId && !t.completedAt); if (active && state.settings.widgetsEnabled) await instance.update(snapshot(active), new Date(Date.now() + 15 * 60000)); else await instance.end('immediate'); } }
export async function startPackingActivity(trip: Trip) { if (!activity) throw new Error('Widgets require a development build.'); for (const instance of activity.getInstances()) await instance.end('immediate'); await AsyncStorage.setItem('@waylo/device/live-trip', trip.id); activity.start(snapshot(trip), `waylo://packing?id=${trip.id}`, new Date(Date.now() + 15 * 60000)); }
export async function endPackingActivities() { if (!activity) throw new Error('Widgets require a development build.'); for (const instance of activity.getInstances()) await instance.end('immediate'); }

let widgetQueue: Promise<void> = Promise.resolve();
export function updatePackingWidget(state: TravelState) { const operation = widgetQueue.then(() => applyPackingWidget(state)); widgetQueue = operation.catch(() => {}); return operation; }
