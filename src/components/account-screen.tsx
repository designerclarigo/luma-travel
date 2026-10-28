import { Text } from '@/components/language-provider';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useCloud } from './cloud-provider';
import { AuthScreen } from './auth-screen';
import { Field, j, Section, single, TextAction } from './journey-ui';
import { useTravel } from './travel-provider';
import { ActionButton, Icon, PageHeading, Screen, Sheet, TravelGate, ui } from './travel-ui';
import { useDurableAction } from '@/hooks/use-durable-action';
import { checkCloudConnection, requireCloud } from '@/lib/cloud-client';
import { accountIdentity, authMessage } from '@/lib/auth-policy';
import { acceptRoom, getRoom, joinRoom, type Room } from '@/lib/collaboration';
import { palette } from '@/constants/waylo';
import { dateLabel } from '@/lib/travel-state';
import { useLocalDemo } from './local-demo-provider';

export function AccountScreen() { return <TravelGate><AccountRouter /></TravelGate>; }
function AccountRouter() {
  const { session, loading } = useCloud();
  const demo = useLocalDemo();
  if (demo.active) return <DemoAccount />;
  if (loading) return <Screen><View style={{ padding: 32, gap: 16, alignItems: 'center' }}><ActivityIndicator color={palette.pine} /><Text style={ui.body}>Restoring your secure sign-in…</Text></View></Screen>;
  if (!session?.user.email_confirmed_at) return <AuthScreen mode="login" />;
  return <SignedAccount key={session.user.id} />;
}
function DemoAccount() {
  const demo = useLocalDemo(), action = useDurableAction(); const { data } = useTravel();
  return <Screen scroll><PageHeading back title="A little room to explore." subtitle="Local development demo account" /><View style={j.content}><View style={j.note}><Text style={j.kicker}>DEMO ACCOUNT · DEVICE ONLY</Text><Text style={j.title}>{data!.profile.name}</Text><Text style={ui.body}>Plan trips, save destinations and try packing lists without email setup. Your demo collection is stored separately from your regular device plans.</Text></View><Section title="Your demo collection"><Text style={ui.body}>{data!.trips.length} trips · {data!.saved.length} saved places</Text><ActionButton secondary onPress={() => router.navigate('/home')}>Continue exploring</ActionButton><ActionButton secondary onPress={() => router.navigate('/profile')}>Edit demo profile</ActionButton></Section><Section title="Ready for your real account?"><Text style={ui.body}>Cloud publishing, account backups, invitations, AI requests and administrator access require real authentication. This demo does not create a Supabase user or mark an email verified.</Text><Text style={ui.small}>Exiting keeps your demo collection for next time and restores your regular device collection. Nothing is uploaded or merged.</Text>{!!action.error && <Text accessibilityRole="alert" style={ui.error}>{action.error}</Text>}<ActionButton busy={action.busy} onPress={() => void action.run(async () => { await demo.stop(); router.replace('/login'); })}>Exit demo & sign in</ActionButton></Section></View></Screen>;
}
function SignedAccount() {
  const cloud = useCloud(); const session = cloud.session!;
  const { data, update } = useTravel(); const params = useLocalSearchParams<{ invite?: string; logout?: string }>(); const action = useDurableAction();
  const identity = accountIdentity(cloud.profile, session.user.email);
  const [invite, setInvite] = useState(single(params.invite) ?? '');
  const [rooms, setRooms] = useState<Omit<Room, 'document'>[]>([]), [roomsLoaded, setRoomsLoaded] = useState(false);
  const [pending, setPending] = useState<Room | null>(null), [confirm, setConfirm] = useState(single(params.logout) === '1'), [picker, setPicker] = useState(false), [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(identity);
  const openEditor = () => { setDraft(identity); action.setError(''); setEditing(true); };
  const refreshRooms = () => action.run(async () => {
    const { data: result, error } = await requireCloud().from('waylo_rooms').select('id,owner,revision,updated_at').order('updated_at', { ascending: false }).limit(100);
    if (error) throw new Error(authMessage(error)); setRooms(result ?? []); setRoomsLoaded(true);
  }, 'Your accessible cloud journeys are up to date.');
  return <Screen scroll><PageHeading back title="Your travels. A little closer." subtitle="Your Waylo account, thoughtfully connected." /><View style={j.content}>
    <View style={j.note}><View style={j.between}><Text style={j.kicker}>YOUR WAYLO ACCOUNT</Text><View style={j.row}><Icon name="shield" size={16} /><Text style={ui.small}>{session.user.email_confirmed_at ? 'Email verified' : 'Confirm your email'}</Text></View></View>
      <Text localize={false} style={j.heading}>{identity.name}</Text><Text localize={false} style={ui.body}>{session.user.email}</Text>{!!identity.location && <Text localize={false} style={ui.small}>{identity.location}</Text>}
      <TextAction icon="edit" label="Edit account details" onPress={openEditor} />
      {cloud.profileLoading && <Text style={ui.small}>Loading your account profile…</Text>}
      {!!cloud.profileError && <><Text accessibilityRole="alert" style={ui.error}>{cloud.profileError}</Text><TextAction label="Retry account profile" onPress={cloud.refreshProfile} /></>}
    </View>
    {cloud.recovery && cloud.recovery.userId === session.user.id && <ActionButton onPress={() => router.push('/reset-password')}>Continue password reset</ActionButton>}
    <Section title="Your plans, your choice"><Text style={ui.body}>Your trips stay saved on this device. Review a journey before choosing to publish its itinerary and packing list.</Text>
      <View style={j.card}><Text style={j.kicker}>{data!.trips.length} DEVICE {data!.trips.length === 1 ? 'JOURNEY' : 'JOURNEYS'}</Text><Text style={j.title}>Save a little inspiration.</Text><Text style={ui.small}>Cloud saves are always explicit. Signing in never uploads your existing trips.</Text><ActionButton onPress={() => data!.trips.length ? setPicker(true) : router.push('/plan')}>{data!.trips.length ? 'Choose a trip to save to cloud' : 'Plan your first journey'}</ActionButton></View>
    </Section>
    <Section title="Connection status"><Text style={ui.body}>Check your account, database schema and read permissions without uploading a trip.</Text><ActionButton secondary busy={action.busy} onPress={() => void action.run(async () => action.setMessage(await checkCloudConnection()))}>Check cloud connection</ActionButton></Section>
    <Section title="Travel together"><Text style={ui.body}>Have a private invitation from a companion? Review their shared journey before bringing a copy to this device.</Text><Field label="Invitation code" value={invite} onChange={setInvite} /><ActionButton secondary busy={action.busy} onPress={() => void action.run(async () => setPending(await joinRoom(invite)))}>Review shared trip</ActionButton></Section>
    <Section title="Your cloud journeys"><ActionButton secondary busy={action.busy} onPress={() => void refreshRooms()}>Refresh cloud trips</ActionButton>
      {roomsLoaded && rooms.length === 0 && <View style={j.card}><Icon name="cloud" size={28} /><Text style={j.title}>Room for your next story.</Text><Text style={ui.body}>No shared journeys are available for this account yet. Choose a device trip above to publish one.</Text></View>}
      {rooms.map((room) => <View key={room.id} style={j.card}><Text style={ui.label}>Shared journey · {room.id.slice(0, 8)}</Text><Text style={ui.small}>Revision {room.revision} · {new Date(room.updated_at).toLocaleString()}</Text><TextAction label="Review cloud copy" onPress={() => void action.run(async () => setPending(await getRoom(room.id)))} /></View>)}
    </Section>
    <Section title="Account & privacy"><Text style={ui.small}>Your account name and home city are visible to authorized Waylo administrators. Published journeys include dates, traveler details, notes and packing. Share invitations only with people you trust.</Text><TextAction icon="backup" label="Backup & file sharing" onPress={() => router.push('/backup')} /><Text style={ui.small}>Verify your email once, then sign in with your email and password.</Text><TextAction label="Sign out" onPress={() => setConfirm(true)} /></Section>
    {!!action.error && <Text accessibilityRole="alert" style={ui.error}>{action.error}</Text>}{!!action.message && <Text accessibilityLiveRegion="polite" style={j.success}>{action.message}</Text>}
  </View>
  <Sheet title="Your account, a little more you." visible={editing} onClose={() => { if (!action.busy) setEditing(false); }}><Field label="Your name" value={draft.name} onChange={(name) => setDraft((v) => ({ ...v, name }))} /><Field label="Home city (optional)" value={draft.location} onChange={(location) => setDraft((v) => ({ ...v, location }))} /><Text style={ui.small}>These account details are saved to your private Supabase profile. Your device trips are kept as they are.</Text>{!!action.error && <Text style={ui.error}>{action.error}</Text>}<ActionButton busy={action.busy} onPress={() => void action.run(() => cloud.saveIdentity(draft), 'Your account details are saved.').then((ok) => { if (ok) setEditing(false); })}>Save account details</ActionButton></Sheet>
  <Sheet title="Choose a journey to save." visible={picker} onClose={() => setPicker(false)}><Text style={ui.body}>Open a trip’s sharing screen to review its content and publish it. Nothing is uploaded by selecting a trip.</Text>{data!.trips.map((trip) => <View key={trip.id} style={j.card}><Text localize={false} style={j.title}>{trip.title}</Text><Text style={ui.small}>{dateLabel(trip.departure)} – {dateLabel(trip.endDate)}</Text><ActionButton secondary onPress={() => { setPicker(false); router.push({ pathname: '/share-trip', params: { id: trip.id } }); }}>Review cloud save</ActionButton></View>)}</Sheet>
  <Sheet title="Bring this shared journey here?" visible={pending !== null} onClose={() => { if (!action.busy) setPending(null); }}>{pending && <><Text style={ui.body}>Revision {pending.revision} · updated {new Date(pending.updated_at).toLocaleString()}. A local copy remains available offline.</Text><Text style={ui.small}>For a linked trip, accepting replaces its device itinerary and packing list. Export a backup first to keep unpublished changes.</Text><TextAction label="Open backup & file sharing" onPress={() => { setPending(null); router.push('/backup'); }} />{!!action.error && <Text style={ui.error}>{action.error}</Text>}<ActionButton busy={action.busy} onPress={() => void action.run(() => update((value) => acceptRoom(value, pending, session.user.id, value.cloudLinks.find((link) => link.roomId === pending.id && link.userId === session.user.id))), 'Cloud trip saved locally.').then((ok) => { if (ok) { setPending(null); router.navigate('/trips'); } })}>Accept cloud copy</ActionButton></>}</Sheet>
  <Sheet title="A little pause, not goodbye." visible={confirm} onClose={() => { if (!action.busy) setConfirm(false); }}><Text style={ui.body}>Sign out of this device? All your local trips and packing lists stay saved. Shared editing resumes when you sign in again.</Text>{!!action.error && <Text style={ui.error}>{action.error}</Text>}<ActionButton busy={action.busy} onPress={() => void action.run(async () => { await cloud.logout(); router.replace('/login'); })}>Sign out of this device</ActionButton></Sheet>
  </Screen>;
}
