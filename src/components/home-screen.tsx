import { TravelSwitch as Switch } from '@/components/travel-switch';
import { MotionPressable as Pressable } from '@/components/motion-pressable';
import { Text } from '@/components/language-provider';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTravel } from '@/components/travel-provider';
import { useWayloLaunch } from '@/components/waylo-launch';
import { ActionButton, Bookmark, Icon, IconButton, type IconName, Photo, Screen, Sheet, StatePanel, TravelGate, ui, WayloMotif } from '@/components/travel-ui';
import { categories, type Category, type Destination, destinations } from '@/constants/destinations';
import { palette, typography } from '@/constants/waylo';
import { profileInitials } from '@/lib/profile';
import { defaultFilters, filterDestinations, type Filters } from '@/lib/travel-state';

const categoryIcons: Record<Category, IconName> = { All: 'explore', Beaches: 'beach', Mountains: 'mountain', Cities: 'city', Nature: 'leaf' };
export function HomeScreen() { return <TravelGate><HomeContent /></TravelGate>; }

function HomeContent() {
  const { data } = useTravel(); const { reducedMotion } = useWayloLaunch();
  const { width, fontScale } = useWindowDimensions();
  const [query, setQuery] = useState(''); const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filterOpen, setFilterOpen] = useState(false); const [draft, setDraft] = useState<Filters>(defaultFilters);
  const results = useMemo(() => filterDestinations(destinations, query, filters), [filters, query]);
  const filterCount = Number(filters.budget !== null) + Number(filters.highlyRated);
  const searching = query.trim() !== '' || filters.category !== 'All' || filterCount > 0;
  const cardWidth = Math.min(296, width - 64);
  const draftCount = filterDestinations(destinations, query, draft).length;
  const name = data!.profile.name.trim().split(/\s+/)[0];
  const initials = profileInitials(data!.profile.name);
  const hour = new Date().getHours(); const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const clear = () => { setQuery(''); setFilters(defaultFilters); Keyboard.dismiss(); };
  const entering = reducedMotion ? undefined : FadeInDown.duration(240);
  return <Screen scroll>
    <Animated.View entering={entering} style={styles.header}>
      <View style={styles.greetingBlock}><Text style={styles.greeting}>{greeting}, {name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Current location: ${data!.profile.location}. Edit location`} onPress={() => router.navigate('/profile')} style={styles.location}>
          <Icon name="pin" size={13} /><Text style={styles.locationLabel}>{data!.profile.location}</Text><Text style={styles.chevron}>⌄</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.navigate('/profile')} style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}><Text allowFontScaling={false} style={styles.initials}>{initials}</Text></Pressable>
      <View><IconButton name="bell" label="Notifications" onPress={() => router.push('/notifications')} />{data!.notifications.some((item) => !item.read && (data!.preferences.inspiration || !!item.tripId)) && <View style={styles.notificationDot} />}</View>
    </Animated.View>

    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(40).duration(280)} style={styles.intro}>
      <Text accessibilityRole="header" style={[styles.headline, width < 360 && { fontSize: 36, lineHeight: 40 }]}>Where will your{fontScale > 1.3 ? ' ' : '\n'}next story begin?</Text>
      <View style={styles.searchBar}>
        <Icon name="search" size={20} color={palette.muted} />
        <Pressable accessibilityRole="button" accessibilityLabel="Search destinations, stays, experiences" onPress={() => router.push('/search')} style={[styles.searchInput, { justifyContent: 'center' }]}><Text style={{ fontFamily: typography.sans, fontSize: 14, lineHeight: 22, color: palette.muted }}>Search destinations, stays, experiences</Text></Pressable>
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearSearch}><Icon name="close" size={16} /></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ''}`} onPress={() => { Keyboard.dismiss(); setDraft(filters); setFilterOpen(true); }} style={styles.filterButton}>
          <Icon name="filter" size={20} />{filterCount > 0 && <View style={styles.filterDot} />}
        </Pressable>
      </View>
    </Animated.View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories} keyboardShouldPersistTaps="handled">
      {categories.map((category) => <Pressable key={category} accessibilityRole="button" feedback={filters.category !== category} aria-selected={filters.category === category} accessibilityState={{ selected: filters.category === category }} onPress={() => { setFilters((value) => ({ ...value, category })); Keyboard.dismiss(); }}
        style={({ pressed }) => [styles.chip, filters.category === category && styles.selectedChip, pressed && { opacity: 0.75 }]}>
        <Icon name={categoryIcons[category]} size={17} color={filters.category === category ? palette.canvas : palette.pine} /><Text style={[styles.chipLabel, filters.category === category && { color: palette.canvas }]}>{category}</Text>
      </Pressable>)}
    </ScrollView>

    <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>{searching ? 'Your discoveries' : 'Popular destinations'}</Text>{(searching || (width >= 360 && fontScale < 1.3)) && <Text style={styles.sectionAside}>{searching ? `${results.length} ${results.length === 1 ? 'place' : 'places'}` : 'HANDPICKED'}</Text>}</View>
    {results.length === 0 ? <StatePanel icon="search" title="A little further afield?" body="No places match just yet. Try another destination or give your filters a little more room." action="Clear search & filters" onAction={clear} /> :
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail} decelerationRate="fast" snapToInterval={cardWidth + 16} snapToAlignment="start" keyboardShouldPersistTaps="handled">
        {results.map((destination) => <DestinationCard key={destination.id} destination={destination} width={cardWidth} />)}
      </ScrollView>}

    <View style={styles.banner}>
      <View style={styles.bannerCopy}><Text style={styles.bannerEyebrow}>A LITTLE PLANNING. A LOT OF LIVING.</Text><Text accessibilityRole="header" style={styles.bannerTitle}>Plan your next escape</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/plan')} style={styles.bannerAction}><Text style={styles.bannerActionLabel}>Let’s make a plan</Text><Icon name="arrow" size={16} color={palette.champagne} /></Pressable>
      </View><View style={styles.bannerMotif} pointerEvents="none"><WayloMotif /></View>
    </View>

    {!searching && <><View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>Recommended for you</Text><Icon name="explore" size={19} color={palette.muted} /></View>
      <View style={styles.recommended}>{[destinations[3], destinations[4], destinations[2]].map((place) => <DestinationRow key={place.id} destination={place} />)}</View></>}
    <Text style={styles.sampleNote}>Curated inspiration · Sample USD prices & ratings</Text>

    <Sheet title="Your kind of escape" visible={filterOpen} onClose={() => setFilterOpen(false)}>
      <View style={{ gap: 16 }}><Text style={ui.label}>Starting budget, per person</Text><View style={styles.budgetOptions}>
        {[null, 200, 400].map((budget) => <Pressable key={String(budget)} accessibilityRole="button" aria-selected={draft.budget === budget} accessibilityState={{ selected: draft.budget === budget }} onPress={() => setDraft((value) => ({ ...value, budget }))} style={[styles.chip, draft.budget === budget && styles.selectedChip]}><Text style={[styles.chipLabel, draft.budget === budget && { color: palette.canvas }]}>{budget === null ? 'Any budget' : `Up to $${budget}`}</Text></Pressable>)}
      </View></View>
      <View style={styles.switchRow}><View style={{ flex: 1, gap: 8 }}><Text style={ui.label}>Only the highest rated</Text><Text style={ui.small}>Sample rating of 4.9 or above</Text></View><Switch accessibilityLabel="Only the highest rated" value={draft.highlyRated} onValueChange={(value) => setDraft((previous) => ({ ...previous, highlyRated: value }))} trackColor={{ false: palette.border, true: palette.pine }} thumbColor={palette.canvas} /></View>
      <Text style={ui.small}>Prices and ratings are illustrative travel inspiration. Availability and bookings are not connected.</Text>
      <ActionButton onPress={() => { setFilters(draft); setFilterOpen(false); }}>Show {draftCount} {draftCount === 1 ? 'place' : 'places'}</ActionButton>
      <ActionButton secondary onPress={() => setDraft({ ...defaultFilters, category: filters.category })}>Reset filters</ActionButton>
    </Sheet>
  </Screen>;
}

export function DestinationCard({ destination, width }: { destination: Destination; width: number }) {
  const { fontScale } = useWindowDimensions();
  return <View style={[styles.destinationCard, { width }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${destination.name}, ${destination.country}, sample rating ${destination.rating}, from $${destination.price} per person`} onPress={() => router.push({ pathname: '/destination', params: { id: destination.id } })} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <View style={[styles.cardPhoto, { height: 216 * Math.max(1, fontScale * 0.75) }]}><Photo source={destination.image} position={destination.id === 'bali' ? 'top' : destination.position} style={StyleSheet.absoluteFill} /><LinearGradient colors={['transparent', 'rgba(14,40,33,0.92)']} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.rating}><Icon name="star" size={12} color={palette.pine} /><Text style={styles.ratingLabel}>{destination.rating.toFixed(1)}</Text></View>
        <View style={styles.cardCaption}><Text style={styles.destinationName}>{destination.name}</Text><View style={styles.countryRow}><Icon name="pin" size={12} color={palette.canvas} /><Text style={styles.country}>{destination.country}</Text></View></View>
      </View>
      <View style={styles.cardFooter}><Text style={styles.from}>From <Text style={styles.price}>${destination.price}</Text><Text style={styles.perPerson}> / person</Text></Text><View style={styles.cardArrow}><Icon name="arrow" size={16} /></View></View>
    </Pressable><Bookmark id={destination.id} name={destination.name} />
  </View>;
}

export function DestinationRow({ destination }: { destination: Destination }) {
  const { fontScale } = useWindowDimensions();
  const large = fontScale > 1.3;
  return <View style={styles.destinationRow}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${destination.name}, ${destination.country}, from $${destination.price} per person`} onPress={() => router.push({ pathname: '/destination', params: { id: destination.id } })} style={({ pressed }) => [styles.rowLink, large && { flexDirection: 'column', alignItems: 'stretch' }, pressed && { opacity: 0.7 }]}>
      <Photo source={destination.image} position={destination.id === 'bali' ? 'top' : destination.position} style={large ? { width: '100%', height: 176, borderRadius: 16 } : styles.thumbnail} />
      <View style={[styles.rowCopy, large && { paddingRight: 0 }]}><Text style={styles.rowName}>{destination.name}</Text><Text style={styles.rowCountry}>{destination.country}</Text>
        <View style={styles.rowRating}><Icon name="star" size={12} /><Text style={styles.rowMeta}>{destination.rating.toFixed(1)} · {destination.duration}</Text></View>
        <Text style={styles.rowPrice}>From ${destination.price}<Text style={styles.perPerson}> / person</Text></Text>
      </View>
    </Pressable><Bookmark id={destination.id} name={destination.name} dark />
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }, greetingBlock: { flex: 1 }, greeting: { fontFamily: typography.medium, fontSize: 14, color: palette.ink },
  location: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingRight: 8 }, locationLabel: { flexShrink: 1, fontFamily: typography.sans, fontSize: 12, color: palette.muted }, chevron: { color: palette.muted, fontSize: 14 },
  avatar: { width: 48, height: 48, backgroundColor: palette.sage, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border }, initials: { fontFamily: typography.editorial, fontSize: 20, color: palette.pine }, notificationDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, top: 11, right: 13, backgroundColor: palette.champagne, borderWidth: 1, borderColor: palette.canvas },
  intro: { paddingHorizontal: 24, gap: 24 }, headline: { fontFamily: typography.editorial, fontSize: 44, lineHeight: 48, letterSpacing: -1.2, color: palette.ink },
  searchBar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.white, gap: 8 }, searchInput: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 16, fontFamily: typography.sans, fontSize: 13, color: palette.ink }, filterButton: { width: 48, minHeight: 48, borderLeftWidth: 1, borderLeftColor: palette.border, alignItems: 'center', justifyContent: 'center', marginVertical: 4 }, clearSearch: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, filterDot: { position: 'absolute', top: 8, right: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.champagne },
  categories: { paddingHorizontal: 24, paddingTop: 24, gap: 8 }, chip: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, selectedChip: { backgroundColor: palette.pine, borderColor: palette.pine }, chipLabel: { fontFamily: typography.medium, fontSize: 13, color: palette.pine },
  sectionHeader: { marginTop: 24, marginBottom: 16, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, sectionTitle: { flexShrink: 1, fontFamily: typography.editorial, fontSize: 28, lineHeight: 32, letterSpacing: -0.5, color: palette.ink }, sectionAside: { fontFamily: typography.medium, fontSize: 11, letterSpacing: 1.4, color: palette.muted },
  destinationRail: { paddingHorizontal: 24, paddingBottom: 8, gap: 16 }, destinationCard: { borderRadius: 24, backgroundColor: palette.white, overflow: 'hidden', borderWidth: 1, borderColor: '#E7E8E0' }, cardPhoto: { height: 224, backgroundColor: palette.sage, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, rating: { position: 'absolute', top: 16, left: 16, minHeight: 28, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 16, backgroundColor: palette.canvas }, ratingLabel: { fontFamily: typography.medium, fontSize: 12, color: palette.pine },
  cardCaption: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 4 }, destinationName: { fontFamily: typography.editorial, fontSize: 30, lineHeight: 34, color: palette.canvas }, countryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, country: { fontFamily: typography.sans, fontSize: 13, color: palette.canvas }, cardFooter: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, from: { flexShrink: 1, fontFamily: typography.sans, fontSize: 13, color: palette.muted }, price: { fontFamily: typography.medium, fontSize: 17, color: palette.pine }, perPerson: { fontFamily: typography.sans, fontSize: 12, color: palette.muted }, cardArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' },
  banner: { marginHorizontal: 24, marginTop: 24, padding: 24, borderRadius: 24, backgroundColor: palette.pine, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, bannerCopy: { flex: 1, zIndex: 1 }, bannerEyebrow: { fontFamily: typography.medium, fontSize: 11, letterSpacing: 1.3, color: '#D9DCCF' }, bannerTitle: { fontFamily: typography.editorial, fontSize: 27, lineHeight: 32, color: palette.canvas, marginTop: 8 }, bannerAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }, bannerActionLabel: { fontFamily: typography.medium, fontSize: 13, color: palette.champagne }, bannerMotif: { position: 'absolute', right: -16, top: 8, opacity: 0.45 },
  recommended: { paddingHorizontal: 24, gap: 16 }, destinationRow: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, overflow: 'hidden' }, rowLink: { padding: 16, flexDirection: 'row', gap: 16, alignItems: 'center' }, thumbnail: { width: 88, height: 112, borderRadius: 14 }, rowCopy: { flex: 1, paddingRight: 48, paddingVertical: 4 }, rowName: { fontFamily: typography.editorial, fontSize: 24, lineHeight: 28, color: palette.ink }, rowCountry: { fontFamily: typography.sans, fontSize: 12, color: palette.muted, marginTop: 4 }, rowRating: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }, rowMeta: { flexShrink: 1, fontFamily: typography.sans, fontSize: 12, color: palette.muted }, rowPrice: { fontFamily: typography.medium, fontSize: 13, color: palette.pine, marginTop: 8 }, sampleNote: { marginHorizontal: 24, marginTop: 24, fontFamily: typography.sans, fontSize: 12, lineHeight: 16, color: palette.muted }, budgetOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, switchRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
});
