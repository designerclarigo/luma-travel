import { routeDistance } from '@/lib/distance';
import { Text } from '@/components/language-provider';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, Linking, ScrollView, View } from 'react-native';
import { DatePicker } from '@/components/date-picker';
import { j, Section, single, TextAction } from '@/components/journey-ui';
import { PlacePicker } from '@/components/place-picker';
import { useTravel } from '@/components/travel-provider';
import { ActionButton, PageHeading, Screen, Sheet, StatePanel, TravelGate, ui } from '@/components/travel-ui';
import { MotionPressable } from './motion-pressable';
import { RouteStopCard } from './route-stop-card';
import { StopWeatherCard } from './stop-weather-card';
import { catalogPlaces } from '@/constants/places';
import { useDurableAction } from '@/hooks/use-durable-action';
import { type Stop, type WeatherDay } from '@/lib/journey-types';
import { regeneratePacking } from '@/lib/packing-engine';
import { moveRouteStop, routeIssues, validateStops } from '@/lib/route-planning';
import { addDays, dateLabel, localDate, type Trip, tripDays, uniqueId, validateTrip } from '@/lib/travel-state';
import { fetchForecast, temperatureLabel } from '@/lib/weather';

export function RouteScreen() { return <TravelGate><RouteContent /></TravelGate>; }
function RouteContent() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const { data, update } = useTravel(); const trip = data!.trips.find((item) => item.id === single(id)); const action = useDurableAction();
  const [stops, setStops] = useState<Stop[]>(() => {
    if (!trip) return []; if (trip.stops.length) return JSON.parse(JSON.stringify(trip.stops));
    const places = trip.destinationIds.map((id) => [...catalogPlaces, ...data!.customPlaces].find((place) => place.id === id)).filter((place) => place !== undefined); const length = tripDays(trip.departure, trip.endDate);
    return places.map((place, index) => ({ id: uniqueId(), place, arrival: addDays(trip.departure, Math.min(length - 1, Math.floor(index * length / places.length))), departure: index === places.length - 1 ? trip.endDate : addDays(trip.departure, Math.min(length - 1, Math.max(0, Math.floor((index + 1) * length / places.length) - 1))) }));
  });
  const [first, setFirst] = useState(trip?.departure ?? localDate()); const [last, setLast] = useState(trip?.endDate ?? localDate());
  const [itinerary, setItinerary] = useState(trip?.itinerary ?? []); const baselineItinerary = useRef(JSON.stringify(trip?.itinerary ?? []));
  const [picker, setPicker] = useState(false); const [hours, setHours] = useState<{ day: WeatherDay; timezone: string } | null>(null); const [weatherErrors, setWeatherErrors] = useState<string[]>([]);
  const [expandedStop, setExpandedStop] = useState<string | null>(null); const [datesOpen, setDatesOpen] = useState(false);
  const [operation, setOperation] = useState<'route' | 'weather' | 'packing' | null>(null); const operationLock = useRef(false); const weatherRequest = useRef<AbortController | null>(null); const [refreshingPlace, setRefreshingPlace] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const dirty = !!trip && (first !== trip.departure || last !== trip.endDate || JSON.stringify(stops) !== JSON.stringify(trip.stops) || JSON.stringify(itinerary) !== JSON.stringify(trip.itinerary));
  const back = useCallback(() => { if (action.busy && operation === 'route') return; if (dirty) setDiscard(true); else if (router.canGoBack()) router.back(); else router.replace('/trips'); }, [dirty, action.busy, operation, setDiscard]);
  useFocusEffect(useCallback(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => listener.remove(); }, [back]));
  useFocusEffect(useCallback(() => () => weatherRequest.current?.abort(), []));
  if (!trip) return <Screen scroll><StatePanel title="Find your route." body="Choose a saved trip before arranging its stops." action="My Trips" onAction={() => router.navigate('/trips')} /></Screen>;
  const unit = data!.settings.temperature; const draft = { ...trip, departure: first, endDate: last, stops, itinerary }; const issues = routeIssues(stops, draft);
  const edit = (change: () => void) => { if (operationLock.current && operation === 'route') return; action.setError(''); action.setMessage(''); change(); };
  const run = async (kind: typeof operation, work: () => Promise<unknown>, success: string) => { if (operationLock.current) return false; operationLock.current = true; setOperation(kind); try { return await action.run(work, success); } finally { operationLock.current = false; setOperation(null); } };
  const save = async () => {
    const error = issues[0]?.message ?? validateStops(stops, draft) ?? validateTrip(draft, true);
    if (error) { action.setError(error); setExpandedStop(issues.find((issue) => issue.stopId)?.stopId ?? null); return; }
    let committedItinerary = itinerary;
    const saved = await run('route', () => update((value) => {
      const current = value.trips.find((item) => item.id === trip.id); if (!current) throw new Error('This trip is no longer saved.');
      const movedActivities = JSON.stringify(itinerary) !== baselineItinerary.current;
      if (movedActivities && JSON.stringify(current.itinerary) !== baselineItinerary.current) throw new Error('Your itinerary changed while this route was open. Reopen the route before saving to keep those changes.');
      const next: Trip = { ...current, departure: first, endDate: last, stops: [...stops], itinerary: movedActivities ? itinerary : current.itinerary, destinationIds: [...new Set(stops.map((stop) => stop.place.id))], destinationId: stops[0].place.id };
      const latestError = validateTrip(next, true); if (latestError) throw new Error(latestError); committedItinerary = next.itinerary;
      const customPlaces = [...value.customPlaces]; for (const stop of stops) if (stop.place.source !== 'catalog' && !customPlaces.some((place) => place.id === stop.place.id)) customPlaces.push(stop.place);
      return { ...value, customPlaces, trips: value.trips.map((item) => item.id === trip.id ? next.packingGenerated ? regeneratePacking(next, value.weatherCache, value.reviews) : next : item) };
    }), 'Route saved. Dates, linked activities and packing are in step.');
    if (saved) { setItinerary(committedItinerary); baselineItinerary.current = JSON.stringify(committedItinerary); }
  };
  const move = (index: number, delta: number) => edit(() => {
    try { const next = moveRouteStop(stops, index, index + delta, draft); setStops(next.stops); setItinerary(next.itinerary); action.setMessage(`Moved ${stops[index].place.name} to stop ${index + delta + 1}. Stay lengths and linked activities were retained. Save to keep this order.`); }
    catch (cause) { action.setError(cause instanceof Error ? cause.message : 'Couldn’t move this stop. Check its dates.'); }
  });
  const refreshWeather = async () => {
    if (dirty) { action.setError('Save your route changes before refreshing its forecast.'); return; }
    setWeatherErrors([]);
    await run('weather', async () => {
      if (!trip.stops.length) throw new Error('Save your stop dates before checking weather.');
      const places = [...new Map(trip.stops.filter((s) => s.departure >= localDate()).map((s) => [s.place.id, s.place])).values()];
      if (!places.length) throw new Error('These stops are in the past. A current forecast cannot describe historical weather.');
      const controller = new AbortController(); weatherRequest.current = controller;
      await update((value) => ({ ...value, settings: { ...value.settings, weatherEnabled: true } })); const errors: string[] = [];
      try {
        for (const place of places) {
          if (controller.signal.aborted) break; setRefreshingPlace(place.id);
          try { const report = await fetchForecast(place, controller.signal); if (controller.signal.aborted) break; await update((value) => ({ ...value, weatherCache: [report, ...value.weatherCache.filter((item) => item.placeId !== report.placeId)].slice(0, 30) })); }
          catch (cause) { if (!controller.signal.aborted) errors.push(`${place.name}: ${cause instanceof TypeError ? 'Check your connection and try again. Your saved forecast is still available.' : cause instanceof Error ? cause.message : 'Weather unavailable.'}`); }
        }
        if (controller.signal.aborted) throw new Error('Forecast refresh stopped. Saved weather is still available.');
        setWeatherErrors(errors); if (errors.length === places.length) throw new Error('Weather couldn’t be refreshed. Any saved forecast remains available below.');
      } finally { setRefreshingPlace(null); if (weatherRequest.current === controller) weatherRequest.current = null; }
    }, 'Available forecasts saved. Coverage is shown for each destination.');
  };
  return <Screen scroll><Stack.Screen options={{ gestureEnabled: false }} /><PageHeading back onBack={back} title="Your journey, in order." subtitle={trip.title} /><View style={j.content}>
    <View style={j.card}><MotionPressable accessibilityRole="button" accessibilityLabel={datesOpen ? 'Collapse trip dates' : 'Edit trip dates'} accessibilityState={{ expanded: datesOpen }} onPress={() => setDatesOpen((v) => !v)} style={{ gap: 8, minHeight: 64 }}><Text style={j.kicker}>THE DATES AROUND YOUR DAYS</Text><Text style={j.title}>{dateLabel(first)} – {dateLabel(last)}</Text><Text style={ui.small}>{last >= first ? `${tripDays(first, last)} days` : 'Review date range'} · {datesOpen ? 'Hide date editor' : 'Edit trip dates'}</Text></MotionPressable>{datesOpen && <><DatePicker label="Trip first day" value={first} onChange={(date) => edit(() => setFirst(date))} /><DatePicker label="Trip last day" value={last} minimum={first} onChange={(date) => edit(() => setLast(date))} /></>}</View>
    <Section title="One stop at a time." aside={`${stops.length} ${stops.length === 1 ? 'STOP' : 'STOPS'}`}><Text style={ui.small}>Move stops to reshape the journey. Stay lengths and linked activities travel with them; the overall trip dates stay the same.</Text><Text style={ui.small}>About {Math.round(routeDistance(stops)).toLocaleString()} km between stop centres in a straight line. Actual travel routes and journeys from home are excluded.</Text>
      {stops.map((stop, index) => <RouteStopCard key={stop.id} stop={stop} index={index} total={stops.length} expanded={expandedStop === stop.id} warnings={issues.filter((issue) => issue.stopId === stop.id).map((issue) => issue.message)} locked={action.busy} reorderDisabled={issues.length > 0} onToggle={() => setExpandedStop((value) => value === stop.id ? null : stop.id)} onMove={(delta) => move(index, delta)} onChange={(patch) => edit(() => setStops((value) => value.map((item) => item.id === stop.id ? { ...item, ...patch } : item)))} onRemove={() => edit(() => {
        const remaining = stops.filter((item) => item.id !== stop.id); const conflict = itinerary.some((entry) => { const date = addDays(first, entry.day - 1); return entry.destinationId === stop.place.id && date >= stop.arrival && date <= stop.departure && !remaining.some((other) => other.place.id === entry.destinationId && date >= other.arrival && date <= other.departure); });
        if (conflict) { action.setError('Move or remove this destination’s activities in the trip planner before removing the stop.'); return; } setStops(remaining); setExpandedStop(null);
      })} onDiscover={() => { if (dirty) { action.setError('Save this route before exploring its stops.'); return; } router.push({ pathname: '/discover', params: { tripId: trip.id, placeId: stop.place.id } }); }} onMap={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${stop.place.latitude},${stop.place.longitude}`).catch(() => action.setError('Couldn’t open Maps. Please try again.'))} />)}
      {issues.length > 0 && <View style={j.note}><Text accessibilityLiveRegion="polite" style={ui.error}>Review {issues.length} route {issues.length === 1 ? 'warning' : 'warnings'} before saving or reordering.</Text>{issues.filter((issue) => !issue.stopId).map((issue) => <Text key={issue.message} style={ui.error}>{issue.message}</Text>)}</View>}
      <ActionButton secondary disabled={action.busy} onPress={() => setPicker(true)}>Add a destination</ActionButton><ActionButton busy={action.busy && operation === 'route'} disabled={action.busy && operation !== 'route'} onPress={() => void save()}>Save route & dates</ActionButton>
    </Section>
    {action.error !== '' && <Text accessibilityRole="alert" style={ui.error}>{action.error}</Text>}{action.message !== '' && <Text accessibilityLiveRegion="polite" style={j.success}>{action.message}</Text>}
    <Section title="A little foresight"><Text style={ui.body}>A clear view of the days ahead, using your saved destination dates.</Text>{dirty && <Text style={ui.small}>The forecasts below use your saved route. Save your changes to update their travel dates.</Text>}<ActionButton busy={action.busy && operation === 'weather'} disabled={dirty || (action.busy && operation !== 'weather')} onPress={() => void refreshWeather()}>Check real forecasts</ActionButton><Text style={ui.small}>Checking sends saved stop coordinates to Open-Meteo. Its public endpoint is for evaluation and non-commercial use.</Text>{weatherErrors.map((error) => <Text key={error} style={ui.error}>{error}</Text>)}
      {trip.stops.map((stop) => <StopWeatherCard key={stop.id} stop={stop} report={data!.weatherCache.find((item) => item.placeId === stop.place.id)} unit={unit} loading={refreshingPlace === stop.place.id} onHours={(day, timezone) => setHours({ day, timezone })} />)}
      {!trip.stops.length && <Text style={ui.small}>Save the route above to see forecasts for its dated destinations.</Text>}
      <ActionButton secondary busy={action.busy && operation === 'packing'} disabled={dirty || (action.busy && operation !== 'packing')} onPress={() => void run('packing', () => update((value) => ({ ...value, trips: value.trips.map((item) => item.id === trip.id ? regeneratePacking(item, value.weatherCache, value.reviews) : item) })), 'Packing updated from available weather. Your edits stay.')}>Apply available weather to packing</ActionButton><Text style={ui.small}>Cached forecasts stay available offline. Missing days aren’t invented, and stale data is excluded from new packing calculations after six hours.</Text>
    </Section>
  </View><PlacePicker visible={picker} onClose={() => setPicker(false)} onSelect={(place) => { const stop = { id: uniqueId(), place, arrival: stops.length ? stops.at(-1)!.departure : first, departure: last }; edit(() => { setStops((value) => [...value, stop]); setExpandedStop(stop.id); }); setPicker(false); }} /><Sheet title="The hours ahead" visible={hours !== null} onClose={() => setHours(null)}>{hours && <><Text style={ui.body}>{dateLabel(hours.day.date)} · local times in {hours.timezone}</Text><ScrollView contentContainerStyle={{ gap: 16 }}>{hours.day.hours.map((hour) => <View key={hour.time} style={j.between}><Text style={ui.label}>{hour.time.slice(11, 16)}</Text><Text style={ui.body}>{temperatureLabel(hour.temperature, unit)}{hour.rainProbability === null ? '' : ` · ${hour.rainProbability}% rain`}</Text></View>)}</ScrollView><Text style={ui.small}>Actual returned forecast hours from Open-Meteo; limited to the provider’s forecast range.</Text></>}</Sheet><Sheet title="Keep your route changes?" visible={discard} onClose={() => setDiscard(false)}><Text style={ui.body}>This route has unsaved dates, activities or destinations. Your saved trip stays unchanged if you discard them.</Text><ActionButton onPress={() => setDiscard(false)}>Keep editing</ActionButton><TextAction danger label="Discard route changes" onPress={() => { setDiscard(false); if (router.canGoBack()) router.back(); else router.replace('/trips'); }} /></Sheet></Screen>;
}
