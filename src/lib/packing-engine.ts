import { baseCategories, type PackingOptions, type Person, type UsageReview, type WeatherReport } from './journey-types';
import { type PackingItem, type Trip } from './travel-state';
import { cacheIsFresh, climateForStop } from './weather';

export const quantityOf = (item: PackingItem) => item.quantity ?? 1;
export const packedOf = (item: PackingItem) => item.packed ? quantityOf(item) : Math.min(item.packedCount ?? 0, quantityOf(item));
export const canonical = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const itemKey = (item: PackingItem) => `${canonical(item.label)}:${item.ownerId ?? 'adult-0'}`;
export function packingContext(trip: Trip) { return `${trip.packingOptions.type}:${trip.packingOptions.transport}:${trip.packingOptions.climate}:${[...trip.interests].sort().join(',')}`; }
export function synchronizedPeople(trip: Trip): Person[] {
  const children = trip.packingOptions.people.filter((person) => person.age !== null && person.age < 18);
  const adults = trip.packingOptions.people.filter((person) => person.age === null || person.age >= 18);
  const count = Math.max(0, trip.travelers - children.length);
  return [...Array.from({ length: count }, (_, index) => adults[index] ?? { id: `adult-new-${index}`, name: `Traveler ${index + 1}`, age: null }), ...children];
}
export function packingProgress(items: PackingItem[]) {
  const total = items.reduce((sum, item) => sum + quantityOf(item), 0); const packed = items.reduce((sum, item) => sum + packedOf(item), 0);
  return { total, packed, completedRows: items.filter((item) => packedOf(item) === quantityOf(item)).length, rows: items.length, percent: total ? Math.round(packed / total * 100) : 0 };
}
export function togglePacked(item: PackingItem, count?: number): PackingItem { const packedCount = count === undefined ? packedOf(item) === quantityOf(item) ? 0 : quantityOf(item) : Math.max(0, Math.min(quantityOf(item), count)); return { ...item, packedCount, packed: packedCount === quantityOf(item) }; }
export function packingWeather(trip: Trip, reports: WeatherReport[]) {
  const fresh = reports.filter((report) => cacheIsFresh(report));
  const days = trip.stops.flatMap((stop) => fresh.filter((report) => report.placeId === stop.place.id).flatMap((report) => report.days.filter((day) => day.date >= stop.arrival && day.date <= stop.departure)));
  const seasonal: { low: number; high: number; rainDays: number }[] = []; let unknownDays = 0;
  for (const stop of trip.stops) {
    const normal = climateForStop(stop); const available = new Set(fresh.filter((report) => report.placeId === stop.place.id).flatMap((report) => report.days.map((day) => day.date)));
    const date = new Date(`${stop.arrival}T12:00:00Z`); const last = new Date(`${stop.departure}T12:00:00Z`);
    for (let count = 0; date <= last && count < 366; count++, date.setUTCDate(date.getUTCDate() + 1)) if (!available.has(date.toISOString().slice(0, 10))) { const month = normal?.months.find((item) => item.month === date.getUTCMonth() + 1); if (month) seasonal.push(month); else unknownDays++; }
  }
  const o = trip.packingOptions;
  return { cold: ['cold', 'mixed'].includes(o.climate) || o.climate === 'auto' && [...days, ...seasonal].some((day) => day.low < 12), hot: ['hot', 'mixed'].includes(o.climate) || o.climate === 'auto' && [...days, ...seasonal].some((day) => day.high >= 27), rain: o.rain === 'yes' || o.rain === 'auto' && (days.some((day) => (day.rainProbability ?? 0) >= 50 || (day.rainMm ?? 0) >= 2) || seasonal.some((month) => month.rainDays >= 8)), known: o.climate !== 'auto' || unknownDays === 0 && days.length + seasonal.length > 0, seasonal: seasonal.length > 0 };
}
export function generatePacking(trip: Trip, reports: WeatherReport[] = [], reviews: UsageReview[] = []): { items: PackingItem[]; held: PackingItem[]; warnings: string[] } {
  const days = Math.round((Date.parse(`${trip.endDate}T00:00:00Z`) - Date.parse(`${trip.departure}T00:00:00Z`)) / 86400000) + 1;
  const o: PackingOptions = trip.packingOptions; const people = synchronizedPeople(trip); const weather = packingWeather(trip, reports);
  const cycle = o.laundryEvery === null ? days : Math.min(days, o.laundryEvery);
  const warnings: string[] = []; if (!weather.known) warnings.push('Weather is unknown. Check the forecast or choose expected conditions before relying on weather-specific suggestions.');
  if (weather.seasonal) warnings.push('Seasonal averages were used for dates without a current forecast. They are not a prediction.');
  const international = o.international === 'yes' || o.international === 'auto' && !!o.homeCountry && trip.stops.some((stop) => stop.place.countryCode !== o.homeCountry);
  if (o.international === 'auto' && !o.homeCountry) warnings.push('Travel-document requirements are not inferred without a home country. Choose domestic/international explicitly.');
  const generated: PackingItem[] = [];
  const add = (key: string, label: string, categoryId: string, quantity: number, ownerId: string, reason: string, essential = false) => {
    const sourceKey = `${key}:${ownerId}`; if (trip.excludedRules.includes(sourceKey)) return;
    generated.push({ id: `rule-${sourceKey}`, sourceKey, label, categoryId: trip.packingCategories.some((item) => item.id === categoryId) ? categoryId : 'extras', quantity: Math.max(1, Math.min(9999, quantity)), ownerId, packed: false, packedCount: 0, notes: '', reason, essential, edited: false });
  };
  for (const person of people) {
    const child = person.age !== null && person.age < 18; const infant = person.age !== null && person.age < 3;
    add('id', child ? 'Child ID & travel documents' : 'ID & travel documents', 'documents', 1, person.id, 'One set for this traveler.', true);
    if (international) add('passport', 'Passport', 'documents', 1, person.id, 'One passport for each traveler on an international trip.', true);
    add('underwear', 'Underwear', child ? 'family' : 'clothing', cycle + 1, person.id, `${cycle} ${o.laundryEvery === null ? 'trip days' : 'days between washes'} + 1 spare = ${cycle + 1}.`, true);
    add('socks', 'Socks', child ? 'family' : 'clothing', cycle + 1, person.id, `${cycle} days in the packing cycle + 1 spare = ${cycle + 1}.`);
    const spares = o.luggage === 'generous' ? 2 : 1; const tops = child ? cycle + 1 : Math.ceil(cycle / (o.luggage === 'light' ? 3 : 2)) + spares;
    add('tops', child ? 'Child outfits' : 'Tops', child ? 'family' : 'clothing', tops, person.id, child ? `${cycle} days in the packing cycle + 1 spare outfit = ${tops}.` : `One top per ${o.luggage === 'light' ? 3 : 2} days, rounded up, + ${spares} spare = ${tops}.`);
    const bottomDays = o.luggage === 'light' ? 4 : o.luggage === 'generous' ? 2 : 3;
    add('bottoms', 'Bottoms', 'clothing', Math.max(1, Math.ceil(cycle / bottomDays)), person.id, `One pair per ${bottomDays} days in the ${cycle}-day packing cycle, rounded up.`);
    add('sleepwear', 'Sleepwear', 'clothing', Math.max(1, Math.ceil(cycle / 7)), person.id, 'One set per week in the packing cycle, rounded up.');
    add('toothbrush', 'Toothbrush', 'toiletries', 1, person.id, 'One per traveler.', true);
    add('medication', 'Your usual medication & care essentials', 'health', 1, person.id, 'Review your own requirements; no medicine or dose is prescribed.', true);
    if (!child) add('charger', 'Phone charger', 'tech', 1, person.id, 'One per adult; edit shared chargers if you prefer.');
    if (child) add('comfort', 'A familiar comfort item', 'family', 1, person.id, 'A personal choice for this child.');
    if (infant && person.diapers) add('diapers', 'Diapers', 'family', days * 6 + 4, person.id, `${days} days × 6 changes + 4 spares = ${days * 6 + 4}. Editable planning estimate; laundry does not reduce disposables.`);
    if (infant) add('wipes', 'Wipes & changing supplies', 'family', 1, person.id, 'Review the amount for your own routine.');
    if (child && o.transport === 'drive' && person.age !== null && person.age < 8) add('car-seat', 'Suitable child car seat', 'family', 1, person.id, 'Check local age, height and safety requirements; suitability is not inferred.', true);
    if (weather.cold) { add('warm-layer', 'Warm mid-layer', 'clothing', 1, person.id, 'Cool nights or cold conditions from your setting, actual forecast or sourced seasonal averages.'); add('warm-coat', 'Warm outer layer', 'clothing', 1, person.id, 'Keep cold-stop layers even when another stop is warm.'); }
    if (weather.hot) { add('sun-hat', 'Sun hat', 'clothing', 1, person.id, 'Warm conditions from your setting, actual forecast or sourced seasonal averages.'); add('light-layer', 'Light breathable layer', 'clothing', 1, person.id, 'A warm-weather option for this traveler.'); }
    if (weather.rain) add('rain-layer', 'Rain jacket', 'clothing', 1, person.id, 'Rain you selected, forecast rain, or a historically rainy month. See Route & weather for the source.');
    if (o.type === 'business') add('work-outfit', 'Work outfit', 'clothing', Math.max(1, Math.ceil(cycle / 2)), person.id, `One work outfit per 2 days in the ${cycle}-day cycle, rounded up.`);
    if (o.type === 'cruise') {
      add('boarding-bag', 'Boarding-day essentials bag', 'extras', 1, person.id, 'Keep essentials accessible while luggage reaches your cabin.');
      if (o.formalNights > 0) add('cruise-formal', 'Evening outfit', 'clothing', o.formalNights, person.id, `${o.formalNights} evening events entered by you. Check your operator’s dress guidance.`);
      if (o.themeNights.trim()) add('cruise-theme', 'Theme-night pieces', 'activities', 1, person.id, `Your plans: ${o.themeNights.trim()}.`);
    }
  }
  add('reservations', 'Tickets & reservation details', 'documents', 1, 'shared', 'One accessible set for the group.', true);
  add('toothpaste', 'Toothpaste', 'toiletries', 1, 'shared', 'A shared supply; adjust to your group.');
  add('bottle', 'Reusable water bottle', 'extras', people.length, 'shared', `${people.length} travelers × 1 bottle = ${people.length}.`);
  if (o.laundryEvery !== null) add('laundry', 'Laundry supplies', 'extras', 1, 'shared', `You chose laundry every ${o.laundryEvery} days.`);
  if (o.type === 'cruise') add('cruise-docs', 'Cruise boarding documents', 'documents', 1, 'shared', 'Required document details depend on your itinerary and operator.', true);
  const tags = trip.itinerary.filter((entry) => entry.packForActivity && entry.activity && entry.activity !== 'none');
  const gear: Record<string, [string, string][]> = { beach: [['swimwear', 'Swimwear'], ['beach-towel', 'Beach towel']], hike: [['walking-shoes', 'Walking shoes'], ['daypack', 'Daypack']], formal: [['cruise-formal', 'Evening outfit'], ['dress-shoes', 'Dress shoes']], fitness: [['workout', 'Workout outfit']], snorkel: [['swimwear', 'Swimwear'], ['snorkel', 'Snorkel equipment or rental plan']], ski: [['ski-layers', 'Ski base layers'], ['ski-gear', 'Ski equipment or rental plan']], business: [['work-outfit', 'Work outfit']] };
  const grouped = new Map<string, typeof tags>(); for (const entry of tags) grouped.set(entry.activity!, [...(grouped.get(entry.activity!) ?? []), entry]);
  for (const [tag, entries] of grouped) {
    for (const [key, label] of gear[tag] ?? []) for (const person of people) {
      const quantity = tag === 'formal' && key === 'cruise-formal' ? entries.length : 1;
      const existing = generated.find((item) => item.sourceKey === `${key}:${person.id}`);
      if (existing) { if (quantity > quantityOf(existing)) { existing.quantity = quantity; existing.reason = `Largest of your entered evening count and ${entries.length} linked events: ${quantity}.`; } }
      else add(key, label, 'activities', quantity, person.id, `Linked to ${entries.length} ${tag} ${entries.length === 1 ? 'plan' : 'plans'} in your itinerary.`);
    }
  }
  const existingByRule = new Map(trip.packing.filter((item) => item.sourceKey).map((item) => [item.sourceKey, item]));
  const existingByName = new Map(trip.packing.map((item) => [itemKey(item), item])); const consumed = new Set<string>();
  const candidates = generated.map((item) => {
    const previous = existingByRule.get(item.sourceKey) ?? existingByName.get(itemKey(item)); if (!previous) return item;
    consumed.add(previous.id);
    if (previous.edited && !previous.overrides || !previous.sourceKey) return { ...previous, sourceKey: item.sourceKey, reason: previous.reason ?? item.reason, retired: false };
    const merged: PackingItem = { ...previous, ...item, id: previous.id, bagId: previous.bagId, overrides: previous.overrides, edited: !!previous.overrides?.length };
    for (const field of previous.overrides ?? []) if (['label', 'quantity', 'categoryId', 'ownerId', 'notes', 'essential', 'unitWeightGrams'].includes(field)) Object.assign(merged, { [field]: previous[field as keyof PackingItem] });
    const packedCount = Math.min(packedOf(previous), quantityOf(merged));
    return { ...merged, packedCount, packed: packedCount === quantityOf(merged) };
  });
  const retained = trip.packing.filter((item) => !consumed.has(item.id) && (!item.sourceKey || item.edited || packedOf(item) > 0)).map((item) => ({ ...item, retired: !!item.sourceKey }));
  const held: PackingItem[] = []; const items = candidates.filter((item) => {
    const evidence = new Set(reviews.filter((review) => review.context === packingContext(trip) && review.unusedKeys.includes(canonical(item.label))).map((review) => review.tripId)).size;
    const suppress = evidence >= 2 && !item.essential && !item.edited && packedOf(item) === 0;
    if (suppress) held.push({ ...item, reason: 'Held back after unused feedback on at least two distinct similar trips. You can add it back.' });
    return !suppress;
  });
  return { items: [...items, ...retained], held, warnings };
}
export function regeneratePacking(trip: Trip, reports: WeatherReport[] = [], reviews: UsageReview[] = []): Trip {
  const categories = [...trip.packingCategories]; if (!categories.some((item) => item.id === 'extras')) categories.push({ ...baseCategories.find((item) => item.id === 'extras')! });
  return { ...trip, packingOptions: { ...trip.packingOptions, people: synchronizedPeople(trip) }, packingGenerated: true, packingCategories: categories, packing: generatePacking(trip, reports, reviews).items };
}
