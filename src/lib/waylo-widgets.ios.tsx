import { isRunningInExpoGo } from 'expo';
import { type TravelState, type Trip } from './travel-state';
import { runtimeCapabilities } from './runtime-capabilities';

export const widgetAvailable = runtimeCapabilities('ios', isRunningInExpoGo(), false).widgets;
// Merely guarding createWidget() is insufficient: importing expo-widgets also loads
// its native module. Defer the entire runtime until a supported app calls it.
const runtime = () => import('./waylo-widgets-runtime.ios');
export async function updatePackingWidget(state: TravelState) {
  if (widgetAvailable) await (await runtime()).updatePackingWidget(state);
}
export async function startPackingActivity(trip: Trip) {
  if (!widgetAvailable) throw new Error('Widgets and Live Activities require an iOS development or release build.');
  await (await runtime()).startPackingActivity(trip);
}
export async function endPackingActivities() {
  if (!widgetAvailable) throw new Error('Widgets and Live Activities require an iOS development or release build.');
  await (await runtime()).endPackingActivities();
}
