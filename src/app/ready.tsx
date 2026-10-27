import { EntryRedirect } from '@/components/entry-redirect';
import { useCloud } from '@/components/cloud-provider';
import { TravelGate } from '@/components/travel-ui';
import { useWayloLaunch } from '@/components/waylo-launch';
import { entryDestination } from '@/lib/email-otp-policy';
import { ActivityIndicator } from 'react-native';
import { palette } from '@/constants/waylo';

export default function ReadyScreen() {
  const { session, loading } = useCloud();
  const launch = useWayloLaunch();
  return <TravelGate>{loading ? <ActivityIndicator color={palette.pine} accessibilityLabel="Restoring your sign-in" /> : <EntryRedirect href={entryDestination(launch.completed, session)} />}</TravelGate>;
}
