import { router } from 'expo-router';
import { PageHeading, Screen, StatePanel, TravelGate } from '@/components/travel-ui';

export default function NotFoundScreen() {
  return <TravelGate><Screen scroll><PageHeading back title="A little detour." /><StatePanel icon="explore" title="Let’s find your way." body="This page isn’t on the map. Your saved places and travel plans are still here." action="Back to Explore" onAction={() => router.replace('/home')} /></Screen></TravelGate>;
}
