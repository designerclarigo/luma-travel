import { TravelSwitch as Switch } from '@/components/travel-switch';
import { router, type Href } from 'expo-router';
import { type PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Choice, Counter, Field, interests, j, TextAction } from '@/components/journey-ui';
import { Text, useLanguage } from '@/components/language-provider';
import { useTravel } from '@/components/travel-provider';
import { useCloud } from './cloud-provider';
import { useLocalDemo } from './local-demo-provider';
import { accountIdentity } from '@/lib/auth-policy';
import { ActionButton, Icon, type IconName, Screen, Sheet, TravelGate, ui } from '@/components/travel-ui';
import { useWayloLaunch } from '@/components/waylo-launch';
import { useCurrency } from './currency-provider';
import { destinations } from '@/constants/destinations';
import { palette, typography } from '@/constants/waylo';
import { useDurableAction } from '@/hooks/use-durable-action';
import { profileInitials, profileStatistics, saveInboxPreferences, saveProfile, saveTravelDefaults, type InboxPreferences, type TravelDefaults } from '@/lib/profile';

type ProfileSheet = 'edit' | 'preferences' | 'notifications' | 'privacy' | 'support' | 'logout';
const sheetTitles: Record<ProfileSheet, string> = {
  edit: 'The personal touches', preferences: 'Your kind of travel', notifications: 'A little news, your way',
  privacy: 'Your data, close to home.', support: 'A little help along the way.',
  logout: 'A little pause, not goodbye.',
};
const help = [
  { title: 'How are my travel statistics counted?', body: 'Trips counts every saved trip. Saved places counts destinations in your collection. Countries visited counts only places marked Visited in your travel passport. Planned trips and wishlist countries do not count as visits.' },
  { title: 'Where are my plans stored?', body: 'Your plans are saved on this device, including offline. Export a Waylo backup before changing devices or removing the app. Cloud backup and collaboration are optional and require a configured service and sign-in.' },
  { title: 'Can I book a trip in Waylo?', body: 'Waylo helps you discover, plan and pack. Destination content is curated sample content and prices are estimates. Live booking and payments are not connected.' },
  { title: 'How do reminders work?', body: 'Trip updates and travel inspiration control your local inbox. To schedule a device reminder or add a trip to your calendar, open Calendar & reminders and choose a trip. Native tools depend on your device and permissions.' },
];

export function ProfileScreen() { return <TravelGate><ProfileContent /></TravelGate>; }

function ProfileContent() {
  const money = useCurrency();
  const { data: loaded, update } = useTravel(); const data = loaded!;
  const cloud = useCloud(); const shownIdentity = cloud.session ? accountIdentity(cloud.profile, cloud.session.user.email) : data.profile;
  const demo = useLocalDemo();
  const { t, language } = useLanguage(); const { width, fontScale } = useWindowDimensions();
  const action = useDurableAction();
  const [sheet, setSheet] = useState<ProfileSheet | null>(null);
  const [identity, setIdentity] = useState({ ...shownIdentity });
  const [defaults, setDefaults] = useState<TravelDefaults>({ ...data.preferences, interests: [...data.preferences.interests] });
  const [inbox, setInbox] = useState<InboxPreferences>({ tripUpdates: data.preferences.tripUpdates, inspiration: data.preferences.inspiration });
  const [expandedHelp, setExpandedHelp] = useState<number | null>(null);
  const stats = profileStatistics(data, destinations.map((place) => place.id));
  const compact = width < 360; const largeText = fontScale > 1.3;
  const open = (next: ProfileSheet) => {
    setIdentity(cloud.session ? { name: cloud.profile?.full_name ?? '', location: cloud.profile?.home_city ?? '' } : { ...data.profile }); setDefaults({ ...data.preferences, interests: [...data.preferences.interests] });
    setInbox({ tripUpdates: data.preferences.tripUpdates, inspiration: data.preferences.inspiration });
    action.setError(''); action.setMessage(''); setSheet(next);
  };
  const close = () => { if (!action.busy) { setSheet(null); action.setError(''); } };
  const go = (path: Href) => { setSheet(null); router.navigate(path); };
  const save = async () => {
    const saved = await action.run(() => sheet === 'edit' && cloud.session ? cloud.saveIdentity(identity) : update((latest) => sheet === 'edit' ? saveProfile(latest, identity)
      : sheet === 'preferences' ? saveTravelDefaults(latest, defaults) : saveInboxPreferences(latest, inbox)), 'Your changes are saved.');
    if (saved) setSheet(null);
  };
  const preferenceSummary = `${t(data.preferences.pace)} · ${data.preferences.travelers} ${t(data.preferences.travelers === 1 ? 'traveler' : 'travelers')}`;
  const notificationSummary = !data.preferences.tripUpdates && !data.preferences.inspiration ? t('In-app updates off') : t('Choose what reaches your inbox');
  const languageSummary = `${{ en: 'English', es: 'Español', hi: 'हिन्दी' }[language]} · °${data.settings.temperature} · ${data.settings.weight}`;

  return <Screen scroll>
    <View style={[s.content, compact && s.compactContent]}>
      <View style={s.header}>
        <View style={s.headerCopy}><Text style={s.eyebrow}>YOUR WAYLO</Text><Text accessibilityRole="header" style={s.title}>Your little corner.</Text></View>
        <SoftPress label={`${t('Your notifications')}, ${stats.unread} ${t('unread')}`} onPress={() => go('/notifications')} pressStyle={s.bell}>
          <Icon name="bell" size={22} />{stats.unread > 0 && <View pointerEvents="none" style={s.badge}><Text localize={false} style={s.badgeText}>{stats.unread > 99 ? '99+' : stats.unread}</Text></View>}
        </SoftPress>
      </View>

      <View style={s.identityCard}>
        <View style={[s.identityRow, largeText && s.identityStack]}>
          <View style={s.avatarRing}><View style={s.avatar}><Text localize={false} maxFontSizeMultiplier={1.4} style={s.initials}>{profileInitials(shownIdentity.name)}</Text></View></View>
          <View style={[s.identityCopy, largeText && { flex: 0, width: '100%' }]}><Text style={s.eyebrow}>{cloud.session ? 'YOUR WAYLO ACCOUNT' : 'TRAVELLER PROFILE'}</Text><Text localize={false} style={s.name}>{shownIdentity.name}</Text><View style={s.location}><Icon name="pin" size={15} color={palette.muted} /><Text localize={false} style={[ui.small, s.flexText]}>{shownIdentity.location || 'Add a home city'}</Text></View></View>
        </View>
        <SoftPress label="Edit profile" onPress={() => open('edit')} pressStyle={s.editButton}>
          <Icon name="edit" size={17} /><Text style={s.editLabel}>Edit profile</Text><Icon name="chevron" size={15} />
        </SoftPress>
      </View>

      <View style={[s.stats, largeText && s.statsStack]}>
        {([{ label: 'Trips', value: stats.trips, path: '/trips' }, { label: 'Saved places', value: stats.saved, path: '/saved' }, { label: 'Countries visited', value: stats.visited, path: '/passport' }] as const).map((stat, index) => <SoftPress key={stat.path} label={`${stat.value} ${t(stat.label)}`} onPress={() => go(stat.path)} style={[s.statWrap, index > 0 && (largeText ? s.statTopBorder : s.statLeftBorder)]} pressStyle={[s.stat, largeText && s.statWide]}>
          <Text localize={false} style={s.statValue}>{stat.value}</Text><Text style={s.statLabel}>{stat.label}</Text>{largeText && <Icon name="chevron" size={16} />}
        </SoftPress>)}
      </View>
      {!!action.message && !sheet && <Text accessibilityLiveRegion="polite" style={s.success}>{action.message}</Text>}

      <SettingsGroup title="Made for you">
        <SettingsRow icon="filter" label="Travel preferences" detail={preferenceSummary} onPress={() => open('preferences')} first />
        <SettingsRow icon="bell" label="Notification settings" detail={notificationSummary} onPress={() => open('notifications')} />
        <SettingsRow icon="globe" label="Language & units" detail={languageSummary} onPress={() => go('/integrations')} />
        <SettingsRow icon="globe" label="Country & currency" detail={money.currency} onPress={() => go('/currency')} />
      </SettingsGroup>
      <SettingsGroup title="Your travel toolkit">
        <SettingsRow icon="globe" label="Travel passport" detail={t('The places that stay with you')} onPress={() => go('/passport')} first />
        <SettingsRow icon="template" label="Reusable packing templates" onPress={() => go('/templates')} />
        <SettingsRow icon="trips" label="Bags & airline fit" onPress={() => go('/bags')} />
        <SettingsRow icon="explore" label="Discover nearby places" onPress={() => go('/discover')} />
      </SettingsGroup>
      <SettingsGroup title="Privacy & support">
        <SettingsRow icon="shield" label="Privacy & your data" onPress={() => open('privacy')} first />
        <SettingsRow icon="backup" label="Backup & restore" onPress={() => go('/backup')} />
        <SettingsRow icon="cloud" label="Cloud account & collaboration" onPress={() => go('/account')} />
        {!cloud.session && !demo.active && <SettingsRow icon="profile" label="Create a Waylo account" onPress={() => go('/sign-up')} />}
        {demo.active && <SettingsRow icon="replay" label="Exit local demo & sign in" detail="Restore your regular device plans" onPress={() => go('/account')} />}
        {!!cloud.session && <SettingsRow icon="replay" label="Sign out of this device" onPress={() => open('logout')} />}
        <SettingsRow icon="help" label="Help & support" onPress={() => open('support')} />
      </SettingsGroup>
      <SoftPress label="Replay onboarding" onPress={() => go('/onboarding')} pressStyle={s.replay}><Icon name="replay" size={18} /><Text style={s.editLabel}>Replay onboarding</Text><Icon name="chevron" size={16} /></SoftPress>
      <View style={s.footer}><View style={s.footerLine} /><Text style={s.footerText}>A lighter way to get away.</Text><View style={s.footerLine} /></View>
    </View>

    <Sheet title={sheet ? sheetTitles[sheet] : ''} visible={sheet !== null} onClose={close}>
      {sheet === 'logout' && <><Text style={ui.body}>Sign out on this device? Your local trips, packing lists and saved places stay here. You can return with your email and password.</Text>{!!action.error && <Text style={ui.error}>{action.error}</Text>}<ActionButton busy={action.busy} onPress={() => void action.run(async () => { await cloud.logout(); setSheet(null); router.replace('/login'); })}>Sign out of this device</ActionButton></>}
      {sheet === 'edit' && <>
        <Text style={ui.body}>Make this little corner yours.</Text>
        <Field label="Your name" value={identity.name} onChange={(name) => { if (!action.busy) setIdentity((value) => ({ ...value, name })); }} />
        <Field label="Home location" value={identity.location} onChange={(location) => { if (!action.busy) setIdentity((value) => ({ ...value, location })); }} hint={cloud.session ? 'Your home base is saved with your account. Choose your current location on Explore.' : 'Your manually chosen location appears in your Home greeting.'} />
      </>}
      {sheet === 'preferences' && <>
        <Text style={ui.body}>These preferences set the starting point for new trips. Existing plans keep their own details.</Text>
        <Text style={ui.label}>What draws you away?</Text><View style={j.wrap}>{interests.map((interest) => <Choice key={interest} label={interest} selected={defaults.interests.includes(interest)} onPress={() => { if (!action.busy) setDefaults((value) => ({ ...value, interests: value.interests.includes(interest) ? value.interests.filter((item) => item !== interest) : [...value.interests, interest] })); }} />)}</View>
        <Text style={ui.label}>Your preferred pace</Text><View style={j.wrap}>{(['Relaxed', 'Balanced', 'Adventurous'] as const).map((pace) => <Choice key={pace} label={pace} selected={defaults.pace === pace} onPress={() => { if (!action.busy) setDefaults((value) => ({ ...value, pace })); }} />)}</View>
        <Counter label="Usual travelers" value={defaults.travelers} onChange={(travelers) => { if (!action.busy) setDefaults((value) => ({ ...value, travelers })); }} />
      </>}
      {sheet === 'notifications' && <>
        <Text style={ui.body}>A little news, on your terms.</Text>
        {([{ key: 'tripUpdates', title: 'Trip updates', body: 'Add an in-app update when you save or edit a trip.' }, { key: 'inspiration', title: 'Travel inspiration', body: 'Show sample discovery messages in your inbox.' }] as const).map((item) => <View key={item.key} style={[s.switchRow, largeText && s.switchStack]}><View style={s.flexText}><Text style={ui.label}>{item.title}</Text><Text style={[ui.small, { marginTop: 8 }]}>{item.body}</Text></View><View style={s.switchControl}><Switch accessibilityLabel={t(item.title)} hitSlop={12} disabled={action.busy} value={inbox[item.key]} onValueChange={(enabled) => setInbox((value) => ({ ...value, [item.key]: enabled }))} trackColor={{ false: palette.border, true: palette.pine }} thumbColor={palette.canvas} /></View></View>)}
        <Text style={ui.small}>These settings control the local inbox. Device reminders are separately enabled from Calendar & reminders.</Text>
        <TextAction icon="bell" label="Your notifications" disabled={action.busy} onPress={() => go('/notifications')} /><TextAction icon="calendar" label="Calendar & reminders" disabled={action.busy} onPress={() => go('/integrations')} />
      </>}
      {(sheet === 'edit' || sheet === 'preferences' || sheet === 'notifications') && <>
        {!!action.error && <Text accessibilityRole="alert" style={ui.error}>{action.error}</Text>}
        <ActionButton busy={action.busy} onPress={() => void save()}>{sheet === 'edit' ? 'Save profile' : 'Save preferences'}</ActionButton>
        <TextAction label="Cancel" disabled={action.busy} onPress={close} />
      </>}
      {sheet === 'privacy' && <>
        <PrivacyBlock icon="shield" title="On your device" body="Device trips, saved places and travel preferences stay local. This travel storage is not encrypted. Your signed-in account name and home city are saved to Supabase; native sign-in credentials use secure device storage. Removing the app may remove local plans. Export a backup before changing devices." />
        <PrivacyBlock icon="pin" title="You choose what to share" body="You can allow location access on Explore or enter a city manually. Weather and discovery requests send selected coordinates to their named providers. You explicitly choose each trip upload and AI request. Signing out keeps your device trips." />
        <PrivacyBlock icon="leaf" title="A little peace of mind" body="There is no advertising SDK or live booking service. Destination photos and fonts are bundled for offline use. Replaying onboarding keeps your profile and travel plans." />
        <ActionButton secondary onPress={() => go('/backup')}>Backup & restore</ActionButton>
      </>}
      {sheet === 'support' && <>
        <Text style={ui.body}>A few useful answers for your next chapter.</Text>
        <View style={s.groupCard}>{help.map((item, index) => <View key={item.title}>
          <SoftPress label={item.title} expanded={expandedHelp === index} onPress={() => setExpandedHelp((value) => value === index ? null : index)} pressStyle={[s.faq, index > 0 && s.faqBorder]}><Text style={[ui.label, s.flexText]}>{item.title}</Text><Icon name={expandedHelp === index ? 'close' : 'plus'} size={18} /></SoftPress>
          {expandedHelp === index && <Text style={[ui.body, s.faqAnswer]}>{item.body}</Text>}
        </View>)}</View>
        <TextAction icon="backup" label="Backup & restore" onPress={() => go('/backup')} /><TextAction icon="calendar" label="Calendar & reminders" onPress={() => go('/integrations')} />
      </>}
    </Sheet>
  </Screen>;
}

function SoftPress({ children, onPress, label, style, pressStyle, expanded }: PropsWithChildren<{ onPress: () => void; label: string; style?: StyleProp<ViewStyle>; pressStyle?: StyleProp<ViewStyle>; expanded?: boolean }>) {
  const { reducedMotion } = useWayloLaunch(); const { t } = useLanguage(); const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animated]}><Pressable accessibilityRole="button" accessibilityLabel={t(label)} accessibilityState={expanded === undefined ? undefined : { expanded }} onPress={onPress}
    onPressIn={() => { if (!reducedMotion) scale.set(withSpring(0.985, { damping: 22, stiffness: 320 })); }}
    onPressOut={() => scale.set(reducedMotion ? 1 : withSpring(1, { damping: 22, stiffness: 320 }))}
    style={({ pressed }) => [pressStyle, pressed && { backgroundColor: palette.sage }]}>{children}</Pressable></Animated.View>;
}

function SettingsGroup({ title, children }: PropsWithChildren<{ title: string }>) { return <View style={s.group}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text><View style={s.groupCard}>{children}</View></View>; }
function SettingsRow({ icon, label, detail, onPress, first = false }: { icon: IconName; label: string; detail?: string; onPress: () => void; first?: boolean }) {
  return <View>{!first && <View style={s.rowDivider} />}<SoftPress label={label} onPress={onPress} pressStyle={s.settingsRow}><View style={s.rowIcon}><Icon name={icon} size={20} /></View><View style={s.flexText}><Text style={s.rowLabel}>{label}</Text>{detail && <Text localize={false} style={s.rowDetail}>{detail}</Text>}</View><Icon name="chevron" size={16} color={palette.muted} /></SoftPress></View>;
}
function PrivacyBlock({ icon, title, body }: { icon: IconName; title: string; body: string }) { return <View style={{ gap: 8 }}><View style={j.row}><Icon name={icon} size={20} /><Text style={ui.label}>{title}</Text></View><Text style={ui.body}>{body}</Text></View>; }

const s = StyleSheet.create({
  content: { padding: 24, gap: 24 }, compactContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 }, headerCopy: { flex: 1, gap: 8 },
  eyebrow: { fontFamily: typography.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.4, color: palette.muted },
  title: { fontFamily: typography.editorial, fontSize: 36, lineHeight: 40, letterSpacing: -0.5, color: palette.ink },
  bell: { width: 48, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border },
  badge: { position: 'absolute', right: -3, top: -3, minWidth: 20, minHeight: 20, paddingHorizontal: 4, borderRadius: 12, backgroundColor: palette.champagne, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.canvas },
  badgeText: { fontFamily: typography.medium, fontSize: 10, lineHeight: 14, color: palette.pine },
  identityCard: { padding: 24, gap: 24, borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, boxShadow: '0 8px 28px rgba(21, 62, 53, 0.045)' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 16 }, identityStack: { alignItems: 'flex-start', flexDirection: 'column' }, identityCopy: { flex: 1, gap: 8, maxWidth: '100%' },
  avatarRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: palette.champagne, padding: 4 },
  avatar: { flex: 1, borderRadius: 36, backgroundColor: palette.pine, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: typography.editorial, fontSize: 32, color: palette.canvas },
  name: { fontFamily: typography.editorial, fontSize: 30, lineHeight: 34, letterSpacing: -0.3, color: palette.ink },
  location: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flexText: { flex: 1, minWidth: 0 },
  editButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.canvas, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 },
  editLabel: { flexShrink: 1, fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.pine },
  stats: { flexDirection: 'row', paddingVertical: 8 }, statsStack: { flexDirection: 'column' }, statWrap: { flex: 1 },
  statLeftBorder: { borderLeftWidth: 1, borderColor: palette.border }, statTopBorder: { borderTopWidth: 1, borderColor: palette.border },
  stat: { minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8 },
  statWide: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 16 },
  statValue: { fontFamily: typography.editorial, fontSize: 32, lineHeight: 36, color: palette.pine }, statLabel: { fontFamily: typography.sans, fontSize: 11, lineHeight: 16, minHeight: 32, color: palette.muted, flexShrink: 1, textAlign: 'center' },
  success: { ...j.success, padding: 16, borderRadius: 16, backgroundColor: palette.sage },
  group: { gap: 16 }, sectionTitle: { fontFamily: typography.editorial, fontSize: 26, lineHeight: 30, color: palette.ink },
  groupCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', backgroundColor: palette.white },
  settingsRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  rowIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: typography.medium, fontSize: 16, lineHeight: 24, color: palette.ink }, rowDetail: { ...ui.small, marginTop: 4 },
  rowDivider: { height: 1, backgroundColor: palette.border, marginLeft: 72, marginRight: 16, opacity: 0.65 },
  replay: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 8, borderRadius: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 8 }, footerLine: { flex: 1, height: 1, backgroundColor: palette.border }, footerText: { ...ui.small, flexShrink: 1, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 24 }, switchStack: { flexDirection: 'column', alignItems: 'flex-start' },
  switchControl: { minHeight: 48, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  faq: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }, faqBorder: { borderTopWidth: 1, borderColor: palette.border }, faqAnswer: { paddingHorizontal: 16, paddingBottom: 24 },
});
