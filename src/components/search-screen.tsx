import { useCurrency } from './currency-provider';
import { CurrencyNotice } from './currency-ui';
import { Text } from '@/components/language-provider';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';
import { DestinationRow } from '@/components/home-screen';
import { LocationSearch } from './location-search';
import { type Place } from '@/lib/journey-types';
import { Choice, j, Section, single, TextAction } from '@/components/journey-ui';
import { useTravel } from '@/components/travel-provider';
import { ActionButton, Icon, IconButton, PageHeading, Screen, Sheet, StatePanel, TravelGate, ui } from '@/components/travel-ui';
import { categories, destinations } from '@/constants/destinations';
import { palette, typography } from '@/constants/waylo';
import { defaultFilters, filterDestinations, type Filters, rememberSearch, sortDestinations, type SortOrder } from '@/lib/travel-state';

export function SearchScreen() { return <TravelGate><SearchContent /></TravelGate>; }
function SearchContent() {
  const money = useCurrency();
  const params = useLocalSearchParams<{ q?: string; category?: string }>(); const { data, update } = useTravel();
  const [mode, setMode] = useState<'worldwide' | 'collection'>(single(params.category) ? 'collection' : 'worldwide'); const [selected, setSelected] = useState<Place | null>(null); const [selecting, setSelecting] = useState(false);
  const [query, setQuery] = useState(single(params.q) ?? ''); const [filters, setFilters] = useState<Filters>({ ...defaultFilters, category: categories.find((item) => item === single(params.category)) ?? 'All' });
  const [draft, setDraft] = useState(filters); const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null); const [sort, setSort] = useState<SortOrder>('recommended'); const [error, setError] = useState(''); const saving = useRef(false);
  const results = sortDestinations(filterDestinations(destinations, query, filters), sort);
  const draftCount = filterDestinations(destinations, query, draft).length;
  const active = query.trim() !== '' || filters.category !== 'All' || filters.budget !== null || !!filters.minRating;
  const submit = async (text = query) => { setQuery(text); Keyboard.dismiss(); if (saving.current) return; saving.current = true; setError(''); try { await update((value) => rememberSearch(value, text)); } catch { setError('Your search is ready, but recent searches couldn’t be saved. Try searching again.'); } finally { saving.current = false; } };
  const planPlace = async () => { if (!selected || saving.current) return; saving.current = true; setSelecting(true); setError(''); try { await update((value) => rememberSearch({ ...value, customPlaces: [...value.customPlaces.filter((p) => p.id !== selected.id), selected] }, query)); setSelected(null); router.push({ pathname: '/plan', params: { destinationId: selected.id } }); } catch { setError('This place couldn’t be saved. Please try again before planning.'); } finally { saving.current = false; setSelecting(false); } };
  return <Screen scroll><PageHeading back title="Find your somewhere." subtitle="A little curiosity goes a long way." /><View style={j.content}>
    <View style={j.wrap}><Choice label="Worldwide places" selected={mode === 'worldwide'} onPress={() => setMode('worldwide')} /><Choice label="Waylo collection" selected={mode === 'collection'} onPress={() => setMode('collection')} /></View>
    {mode === 'worldwide' ? <><LocationSearch query={query} onQuery={setQuery} onSubmit={() => void submit()} onSelect={(place) => { Keyboard.dismiss(); setError(''); setSelected(place); }} />{!query.trim() && <Section title="Recent searches" aside="ON THIS DEVICE">{data!.recentSearches.length ? <><View style={j.wrap}>{data!.recentSearches.map((item) => <Choice key={item} label={item} onPress={() => setQuery(item)} />)}</View><TextAction label="Clear recent searches" onPress={() => void update((value) => ({ ...value, recentSearches: [] })).catch(() => setError('Couldn’t clear recent searches. Please try again.'))} /></> : <Text style={ui.body}>A city you’ve imagined. A country you’ve yet to meet. Start typing to find it.</Text>}</Section>}<TextAction icon="explore" label="Discover worldwide places & maps" onPress={() => router.push('/discover')} /></> : <>
    <View style={[ui.input, j.row, { paddingVertical: 0 }]}><Icon name="search" /><TextInput accessibilityLabel="Search destinations" placeholder="Destinations, stays, experiences" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} onSubmitEditing={() => void submit()} returnKeyType="search" autoCorrect={false} autoCapitalize="none" maxLength={100} style={{ flex: 1, minWidth: 0, minHeight: 56, color: palette.ink, fontFamily: typography.sans, fontSize: 14 }} />{query !== '' && <IconButton name="close" label="Clear search" onPress={() => setQuery('')} style={{ width: 40 }} />}</View>
    {!active && <><Section title="Recent searches" aside="ON THIS DEVICE">{data!.recentSearches.length ? <><View style={j.wrap}>{data!.recentSearches.map((item) => <Choice key={item} label={item} onPress={() => void submit(item)} />)}</View><TextAction label="Clear recent searches" onPress={() => { void update((value) => ({ ...value, recentSearches: [] })).catch(() => setError('Couldn’t clear recent searches. Please try again.')); }} /></> : <Text style={ui.body}>Your next discovery starts here. Search for a place, a stay or a favourite experience.</Text>}</Section>
      <Section title="Follow a feeling"><View style={j.wrap}>{['Bali', 'Japan tea', 'Nature', 'Beach'].map((item) => <Choice label={item} key={item} onPress={() => void submit(item)} />)}</View></Section></>}
    <TextAction icon="explore" label="Discover worldwide places & maps" onPress={() => router.push('/discover')} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{categories.map((item) => <Choice key={item} label={item} selected={filters.category === item} onPress={() => setFilters((value) => ({ ...value, category: item }))} />)}</ScrollView>
    <View style={j.between}><Text accessibilityLiveRegion="polite" style={ui.label}>{results.length} {results.length === 1 ? 'destination' : 'destinations'}</Text><View style={j.row}><TextAction icon="filter" label="Filters" onPress={() => { Keyboard.dismiss(); setDraft(filters); setSheet('filter'); }} /><TextAction label="Sort" onPress={() => { Keyboard.dismiss(); setSheet('sort'); }} /></View></View>
    {(filters.budget !== null || !!filters.minRating) && <Text style={ui.small}>{filters.budget !== null ? `Up to ${money.format(filters.budget)} / person` : 'Any budget'} · {filters.minRating ? `${filters.minRating}+ rating` : 'Any rating'}</Text>}
    <CurrencyNotice /><Text style={ui.small}>Curated sample destinations · Estimated prices · {sort === 'price' ? 'Lowest price first' : sort === 'rating' ? 'Highest rating first' : 'Handpicked order'}</Text>
    {error !== '' && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {results.map((destination) => <DestinationRow key={destination.id} destination={destination} />)}
    {!results.length && <StatePanel icon="search" title="Take a different path." body="We haven’t found that combination. Try a country, a broader budget or fewer filters." action="Show all destinations" onAction={() => { setQuery(''); setFilters(defaultFilters); }} />}
    </>}{error !== '' && !selected && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>
    <Sheet title={selected?.name ?? 'Your next destination'} visible={!!selected} onClose={() => { if (!selecting) setSelected(null); }}>{selected && <><Text style={ui.body}>{[selected.region, selected.country].filter(Boolean).join(', ')}</Text><Text style={ui.small}>{selected.latitude.toFixed(4)}°, {selected.longitude.toFixed(4)}° · {selected.timezone === 'auto' ? 'Local time resolved with weather' : selected.timezone}</Text>{selected.kind !== 'city' && <Text style={ui.small}>This is a broad reference point. Add specific cities in Route & weather for forecasts at the places you’ll visit.</Text>}<Text style={ui.small}>This place’s GeoNames ID and coordinates will be saved with your plan.</Text>{error !== '' && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}<ActionButton busy={selecting} onPress={() => void planPlace()}>Plan a trip here</ActionButton></>}</Sheet>
    <Sheet title="Your kind of escape" visible={sheet === 'filter'} onClose={() => setSheet(null)}>
      <Section title="The setting"><View style={j.wrap}>{categories.map((item) => <Choice key={item} label={item} selected={draft.category === item} onPress={() => setDraft((value) => ({ ...value, category: item }))} />)}</View></Section>
      <Section title="Starting budget"><Text style={ui.small}>Estimated per person · Uses the same converted price limits</Text><View style={j.wrap}>{[null, 200, 300, 500].map((item) => <Choice key={String(item)} label={item === null ? 'Any budget' : `Up to ${money.format(item)}`} selected={draft.budget === item} onPress={() => setDraft((value) => ({ ...value, budget: item }))} />)}</View></Section>
      <Section title="Minimum rating"><View style={j.wrap}>{[0, 4.8, 4.9].map((item) => <Choice key={item} label={item ? `${item} & above` : 'Any rating'} selected={(draft.minRating ?? 0) === item} onPress={() => setDraft((value) => ({ ...value, minRating: item }))} />)}</View></Section>
      <ActionButton onPress={() => { setFilters(draft); setSheet(null); }}>Show {draftCount} {draftCount === 1 ? 'destination' : 'destinations'}</ActionButton><TextAction label="Reset all filters" onPress={() => setDraft(defaultFilters)} />
    </Sheet>
    <Sheet title="A fresh perspective" visible={sheet === 'sort'} onClose={() => setSheet(null)}>{(['recommended', 'price', 'rating'] as const).map((item) => <Choice key={item} label={item === 'price' ? 'Price: low to high' : item === 'rating' ? 'Highest rated' : 'Handpicked for you'} selected={sort === item} onPress={() => { setSort(item); setSheet(null); }} />)}</Sheet>
  </Screen>;
}
