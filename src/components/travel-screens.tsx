import { Text } from '@/components/language-provider';
import { router } from 'expo-router';
import { View } from 'react-native';
import { DestinationRow } from '@/components/home-screen';
import { j } from '@/components/journey-ui';
import { useTravel } from '@/components/travel-provider';
import { PageHeading, Screen, StatePanel, TravelGate, ui } from '@/components/travel-ui';
import { destinations } from '@/constants/destinations';

export { DestinationScreen } from '@/components/destination-screen';
export { PlanScreen } from '@/components/plan-screen';
export { TripsScreen, TripScreen } from '@/components/trips-screen';
export { NotificationsScreen } from '@/components/notifications-screen';
export { ProfileScreen } from '@/components/profile-screen';

export function SavedScreen() { return <TravelGate><SavedContent /></TravelGate>; }
function SavedContent() {
  const { data } = useTravel(); const saved = destinations.filter((place) => data!.saved.includes(place.id));
  return <Screen scroll><PageHeading title="Your little collection." subtitle="Places for a day, a week, or someday." />
    {saved.length ? <View style={j.content}><Text style={j.kicker}>{saved.length} {saved.length === 1 ? 'PLACE TO DREAM ABOUT' : 'PLACES TO DREAM ABOUT'}</Text>{saved.map((destination) => <DestinationRow key={destination.id} destination={destination} />)}<Text style={ui.small}>Saved on this device. Sample prices and ratings.</Text></View> : <StatePanel icon="saved" title="Keep a little inspiration." body="Tap the bookmark on any destination. Your favourite places will be waiting right here." action="Explore Destinations" onAction={() => router.navigate('/home')} />}
  </Screen>;
}
