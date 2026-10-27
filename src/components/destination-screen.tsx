import { useCurrency } from './currency-provider';
import { CurrencyNotice } from './currency-ui';
import { MotionPressable as Pressable } from '@/components/motion-pressable';
import { Text } from '@/components/language-provider';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, ScrollView, type ScrollViewInstance, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { j, Section, single, TextAction } from '@/components/journey-ui';
import { ActionButton, Bookmark, Icon, IconButton, Photo, Screen, StatePanel, TravelGate, ui } from '@/components/travel-ui';
import { useWayloLaunch } from '@/components/waylo-launch';
import { destinationById } from '@/constants/destinations';
import { destinationGallery, destinationStory } from '@/constants/experiences';
import { palette, typography } from '@/constants/waylo';

export function DestinationScreen() { return <TravelGate><DestinationContent /></TravelGate>; }
function DestinationContent() {
  const money = useCurrency();
  const { id } = useLocalSearchParams<{ id?: string }>(); const place = destinationById(single(id)); const { width, height, fontScale } = useWindowDimensions(); const { reducedMotion } = useWayloLaunch();
  const [expanded, setExpanded] = useState(false); const [gallery, setGallery] = useState<number | null>(null); const galleryRef = useRef<ScrollViewInstance>(null);
  const back = () => router.canGoBack() ? router.back() : router.replace('/home');
  if (!place) return <Screen scroll><StatePanel title="This place wandered off." body="Find another corner of the world in our curated collection." action="Explore destinations" onAction={() => router.replace('/home')} /></Screen>;
  const photos = destinationGallery(place); const story = destinationStory(place);
  return <SafeAreaView style={ui.safe} edges={['top', 'bottom', 'left', 'right']}>
    <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={[s.hero, { height: Math.max(340 * Math.max(1, fontScale * 0.7), Math.min(480, height * 0.52)) }]}><Photo source={place.image} position={place.id === 'bali' ? 'top' : place.position} style={StyleSheet.absoluteFill} /><LinearGradient colors={['transparent', 'rgba(14,40,33,0.94)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
        <View style={s.back}><IconButton name="back" label="Go back" onPress={back} /></View><Bookmark id={place.id} name={place.name} /><View style={s.caption}><Text style={s.eyebrow}>SOMEWHERE WORTH SLOWING DOWN</Text><Text accessibilityRole="header" style={s.heroTitle}>{place.name}</Text><View style={j.row}><Icon name="pin" size={16} color={palette.canvas} /><Text style={s.country}>{place.country}</Text></View></View>
      </View>
      <View style={[j.content, { paddingTop: 24 }]}><View style={j.between}><View style={j.row}><Icon name="star" size={16} /><Text style={ui.label}>{place.rating.toFixed(1)}</Text><Text style={ui.small}>sample rating</Text></View><Text style={ui.small}>{place.duration} of inspiration</Text></View>
        <Section title={place.region}><Text style={ui.body} numberOfLines={expanded ? undefined : 3}>{place.description} {story.story}</Text><TextAction label={expanded ? 'Read less' : 'Read the full story'} onPress={() => setExpanded((value) => !value)} /></Section>
        <TextAction icon="pin" label="Discover real places nearby" onPress={() => router.push({ pathname: '/discover', params: { placeId: place.id } })} /><Section title="The little highlights">{place.highlights.map((item) => <View key={item} style={j.row}><View style={s.check}><Icon name="check" size={16} /></View><Text style={[ui.body, { flex: 1 }]}>{item}</Text></View>)}</Section>
        <Section title="A closer look" aside={`${photos.length} PHOTOS`}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>{photos.map((photo, index) => <Pressable key={photo.caption} accessibilityRole="button" accessibilityLabel={`Open photo ${index + 1}: ${photo.caption}`} onPress={() => setGallery(index)} style={({ pressed }) => [{ width: Math.min(244, width - 96), gap: 8 }, pressed && { opacity: 0.75 }]}><Photo source={photo.image} style={{ height: 180, borderRadius: 20 }} /><Text style={ui.small}>{photo.caption}</Text></Pressable>)}</ScrollView></Section>
        <Section title="Make a little memory" aside="SUGGESTED">{story.experiences.map((experience) => <View style={j.card} key={experience.id}><View style={j.between}><Text style={j.kicker}>{experience.duration.toUpperCase()}</Text><Text style={ui.label}>{experience.cost ? `Est. ${money.format(experience.cost)}` : 'Free suggestion'}</Text></View><Text style={j.title}>{experience.title}</Text><Text style={ui.body}>{experience.description}</Text><TextAction icon="plus" label={`Plan ${experience.title}`} onPress={() => router.push({ pathname: '/plan', params: { destinationId: place.id, experienceId: experience.id } })} /></View>)}</Section>
        <CurrencyNotice /><Text style={ui.small}>Curated sample content. All prices are estimates per person, with no live availability or bookings. Check local conditions before travel.</Text>
      </View>
    </ScrollView>
    <View style={j.footer}><View style={j.between}><Text style={ui.small}>A little inspiration, from</Text><Text style={ui.label}>{money.format(place.price)} / person · estimated</Text></View><ActionButton onPress={() => router.push({ pathname: '/plan', params: { destinationId: place.id } })}>Plan a Trip</ActionButton></View>
    <Modal visible={gallery !== null} animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setGallery(null)}><SafeAreaView style={{ flex: 1, backgroundColor: palette.pine }}>
      <View style={[j.row, { padding: 16 }]}><Text style={[s.country, { flex: 1 }]}>A closer look · {place.name}</Text><IconButton name="close" label="Close photo gallery" onPress={() => setGallery(null)} /></View>
      <ScrollView ref={galleryRef} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, height: '100%' }} horizontal pagingEnabled contentOffset={{ x: (gallery ?? 0) * width, y: 0 }} onContentSizeChange={() => galleryRef.current?.scrollTo({ x: (gallery ?? 0) * width, animated: false })} onMomentumScrollEnd={(event) => setGallery(Math.round(event.nativeEvent.contentOffset.x / width))} showsHorizontalScrollIndicator={false}>
        {photos.map((photo) => <View key={photo.caption} style={{ width, height: '100%', gap: 16, paddingHorizontal: 16, paddingBottom: 16 }}><Image source={photo.image} contentFit="contain" accessibilityLabel={photo.caption} style={{ width: '100%', flex: 1, minHeight: 80 }} /><Text style={[s.country, { textAlign: 'center' }]}>{photo.caption}</Text></View>)}
      </ScrollView>
      <View style={{ padding: 16, gap: 16 }}><Text style={[s.country, { textAlign: 'center' }]}>{(gallery ?? 0) + 1} / {photos.length} · Swipe to explore</Text><View style={j.between}>
        <IconButton name="back" label="Previous photo" disabled={gallery === 0} onPress={() => { const next = Math.max(0, (gallery ?? 0) - 1); galleryRef.current?.scrollTo({ x: next * width, animated: !reducedMotion }); setGallery(next); }} />
        <IconButton name="arrow" label="Next photo" disabled={gallery === photos.length - 1} onPress={() => { const next = Math.min(photos.length - 1, (gallery ?? 0) + 1); galleryRef.current?.scrollTo({ x: next * width, animated: !reducedMotion }); setGallery(next); }} />
      </View></View>
    </SafeAreaView></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({ hero: { margin: 16, marginBottom: 0, borderRadius: 32, overflow: 'hidden' }, back: { position: 'absolute', top: 16, left: 16 }, caption: { position: 'absolute', bottom: 24, left: 24, right: 24, gap: 8 }, eyebrow: { fontFamily: typography.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.3, color: palette.champagne }, heroTitle: { fontFamily: typography.editorial, fontSize: 48, lineHeight: 52, color: palette.canvas }, country: { fontFamily: typography.sans, fontSize: 14, color: palette.canvas }, check: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' } });
