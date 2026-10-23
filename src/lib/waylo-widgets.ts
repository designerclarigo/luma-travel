import { type TravelState, type Trip } from './travel-state';
export const widgetAvailable = false;
export async function updatePackingWidget(_state: TravelState) { /* iOS implementation selected by Metro. */ }
export async function startPackingActivity(_trip: Trip) { throw new Error('Live Activities require a supported iOS development or release build.'); }
export async function endPackingActivities() { throw new Error('Live Activities require a supported iOS build.'); }
