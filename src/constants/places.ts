import { type Place } from '@/lib/journey-types';
// Weather reference points are named explicitly, rather than pretending a whole island has one climate.
export const catalogPlaces: Place[] = [
  { id: 'bali', name: 'Bali · Denpasar', country: 'Indonesia', countryCode: 'ID', latitude: -8.65, longitude: 115.2167, timezone: 'Asia/Makassar', source: 'catalog' },
  { id: 'braies', name: 'Lago di Braies', country: 'Italy', countryCode: 'IT', latitude: 46.6945, longitude: 12.0856, timezone: 'Europe/Rome', source: 'catalog' },
  { id: 'santorini', name: 'Santorini · Oia', country: 'Greece', countryCode: 'GR', latitude: 36.4618, longitude: 25.3753, timezone: 'Europe/Athens', source: 'catalog' },
  { id: 'kyoto', name: 'Kyoto', country: 'Japan', countryCode: 'JP', latitude: 35.0116, longitude: 135.7681, timezone: 'Asia/Tokyo', source: 'catalog' },
  { id: 'maldives', name: 'Maldives · Malé', country: 'Maldives', countryCode: 'MV', latitude: 4.1755, longitude: 73.5093, timezone: 'Indian/Maldives', source: 'catalog' },
];
