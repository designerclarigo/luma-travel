import { MotionPressable as Pressable } from '@/components/motion-pressable';
import { Text } from '@/components/language-provider';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Choice, j, TextAction } from '@/components/journey-ui';
import { useTravel } from '@/components/travel-provider';
import { ActionButton, Icon, PageHeading, Screen, Sheet, StatePanel, TravelGate, ui } from '@/components/travel-ui';
import { palette } from '@/constants/waylo';
import { markNotificationsRead } from '@/lib/travel-state';

export function NotificationsScreen() { return <TravelGate><NotificationsContent /></TravelGate>; }
function NotificationsContent() {
  const { data, update } = useTravel(); const [unreadOnly, setUnreadOnly] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [clear, setClear] = useState(false); const lock = useRef(false);
  const notifications = data!.notifications.filter((item) => (data!.preferences.inspiration || !!item.tripId) && (!unreadOnly || !item.read)); const unread = data!.notifications.filter((item) => !item.read && (data!.preferences.inspiration || !!item.tripId)).length;
  const read = async (id?: string, navigate = false) => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await update((value) => markNotificationsRead(value, id)); if (navigate) { const item = data!.notifications.find((n) => n.id === id); if (item?.tripId) router.push(data!.trips.some((trip) => trip.id === item.tripId) ? { pathname: '/trip', params: { id: item.tripId } } : '/trips'); else router.navigate('/home'); } } catch { setError('Couldn’t update your inbox. Please try again.'); } finally { lock.current = false; setBusy(false); } };
  const clearAll = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await update((value) => ({ ...value, notifications: [], notificationsRead: true })); setClear(false); } catch { setError('Couldn’t clear your inbox. Please try again.'); } finally { lock.current = false; setBusy(false); } };
  return <Screen scroll><PageHeading back title="A little hello." subtitle="The good things, all in one place." /><View style={j.content}><View style={j.wrap}><Choice label="All updates" selected={!unreadOnly} onPress={() => setUnreadOnly(false)} /><Choice label={`Unread (${unread})`} selected={unreadOnly} onPress={() => setUnreadOnly(true)} /></View>
    {unread > 0 && <TextAction label="Mark all as read" disabled={busy} onPress={() => void read()} />}
    {notifications.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.read ? 'Read' : 'Unread'}: ${item.title}. ${item.body}`} disabled={busy} onPress={() => void read(item.id, true)} style={({ pressed }) => [j.card, !item.read && { backgroundColor: '#F0F3EA', borderColor: '#C8D3BF' }, pressed && { opacity: 0.7 }]}><View style={j.row}><Icon name={item.tripId ? 'trips' : 'explore'} size={24} /><Text style={[j.title, { flex: 1 }]}>{item.title}</Text>{!item.read && <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: palette.pine }} />}</View><Text style={ui.body}>{item.body}</Text><Text style={ui.small}>{new Date(item.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {item.read ? 'Read' : 'Unread'}</Text></Pressable>)}
    {!notifications.length && <StatePanel icon="bell" title={unreadOnly ? 'All caught up.' : 'A little quiet, in a good way.'} body={unreadOnly ? 'You’ve read every update. Your next adventure is waiting.' : 'New local trip updates will appear here when you save a plan. Your notification preferences are in Profile.'} action="Explore destinations" onAction={() => router.navigate('/home')} />}
    {error !== '' && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{data!.notifications.length > 0 && <TextAction label="Clear notification history" onPress={() => { setError(''); setClear(true); }} />}<Text style={ui.small}>A local inbox with sample discovery content and updates from your saved plans.</Text>
  </View><Sheet title="A fresh little inbox?" visible={clear} onClose={() => { if (!busy) setClear(false); }}><Text style={ui.body}>Clear your notification history? Your saved trips and destinations will stay in place.</Text>{error !== '' && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}<ActionButton busy={busy} onPress={() => void clearAll()}>Clear history</ActionButton><TextAction label="Keep my updates" disabled={busy} onPress={() => setClear(false)} /></Sheet></Screen>;
}
