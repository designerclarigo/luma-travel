import { Text } from '@/components/language-provider';
import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { Choice, j, Section } from '@/components/journey-ui';
import { Sheet, ui } from '@/components/travel-ui';
import { LocationSearch } from './location-search';
import { catalogPlaces } from '@/constants/places';
import { type Place } from '@/lib/journey-types';

export function PlacePicker({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (place: Place) => void }) {
  return <Sheet title="Find your next stop" visible={visible} onClose={onClose}>{visible && <PickerContent onSelect={onSelect} />}</Sheet>;
}
function PickerContent({ onSelect }: { onSelect: (place: Place) => void }) {
  const [query, setQuery] = useState(''); const locked = useRef(false);
  const choose = (place: Place) => { if (locked.current) return; locked.current = true; Keyboard.dismiss(); onSelect(place); };
  return <><LocationSearch query={query} onQuery={setQuery} onSelect={choose} />{!query.trim() && <Section title="The Waylo collection" aside="OFFLINE SAMPLE PLACES"><View style={j.wrap}>{catalogPlaces.map((place) => <Choice key={place.id} label={`${place.name}, ${place.country}`} onPress={() => choose(place)} />)}</View><Text style={ui.small}>Five curated sample destinations. Worldwide results appear above as you type.</Text></Section>}</>;
}
