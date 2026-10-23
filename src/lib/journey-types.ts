export type Person = { id: string; name: string; age: number | null; diapers?: boolean };
export type Place = { id: string; name: string; country: string; countryCode: string; latitude: number; longitude: number; timezone: string; region?: string; kind?: 'city' | 'country' | 'region'; source: 'catalog' | 'geonames' | 'manual' };
export type Stop = { id: string; place: Place; arrival: string; departure: string };
export type PackingCategory = { id: string; name: string };
export type PackingOptions = { laundryEvery: number | null; luggage: 'light' | 'balanced' | 'generous'; type: 'leisure' | 'business' | 'cruise'; transport: 'fly' | 'drive' | 'rail' | 'sea'; international: 'auto' | 'yes' | 'no'; homeCountry: string; climate: 'auto' | 'hot' | 'mild' | 'cold' | 'mixed'; rain: 'auto' | 'yes' | 'no'; formalNights: number; themeNights: string; cruiseLine: string; people: Person[] };
export type Bag = { id: string; name: string; type: 'personal' | 'cabin' | 'checked'; length: number; width: number; depth: number; measuredKg: number | null; tareKg: number | null };
export type PackingTemplate = { id: string; name: string; categories: PackingCategory[]; items: { label: string; categoryId: string; quantity: number; notes: string; essential: boolean }[] };
export type CountryRecord = { code: string; status: 'visited' | 'wishlist'; visitedOn: string; note: string; regions: string[]; sourceTripIds: string[]; manual: boolean; manualStatus?: 'visited' | 'wishlist' };
export type UsageReview = { tripId: string; context: string; unusedKeys: string[]; reviewedAt: string };
export type WeatherDay = { date: string; low: number; high: number; rainProbability: number | null; rainMm: number | null; code: number | null; hours: { time: string; temperature: number; rainProbability: number | null }[] };
export type WeatherReport = { placeId: string; latitude: number; longitude: number; timezone: string; fetchedAt: string; days: WeatherDay[]; source: 'Open-Meteo'; kind: 'forecast' };
export type CloudLink = { tripId: string; roomId: string; revision: number; signature: string; userId?: string };
export type AppSettings = { language: 'en' | 'es' | 'hi'; temperature: 'C' | 'F'; weight: 'kg' | 'lb'; weatherEnabled: boolean; widgetsEnabled: boolean; hapticsEnabled?: boolean };
export type NearbyPlace = { id: string; name: string; latitude: number; longitude: number; category: string; address: string; website: string; phone: string; openingHours: string; source: 'OpenStreetMap' };
export const baseCategories: PackingCategory[] = [
  { id: 'documents', name: 'Documents' }, { id: 'clothing', name: 'Clothing' }, { id: 'toiletries', name: 'Toiletries' }, { id: 'tech', name: 'Tech' }, { id: 'health', name: 'Personal care' }, { id: 'activities', name: 'Activities' }, { id: 'family', name: 'Family' }, { id: 'extras', name: 'Little extras' },
];
export const defaultSettings: AppSettings = { language: 'en', temperature: 'C', weight: 'kg', weatherEnabled: false, widgetsEnabled: false, hapticsEnabled: true };
export function defaultPackingOptions(travelers: number): PackingOptions { return { laundryEvery: null, luggage: 'balanced', type: 'leisure', transport: 'fly', international: 'auto', homeCountry: '', climate: 'auto', rain: 'auto', formalNights: 0, themeNights: '', cruiseLine: '', people: Array.from({ length: travelers }, (_, index) => ({ id: `adult-${index}`, name: `Traveler ${index + 1}`, age: null })) }; }
