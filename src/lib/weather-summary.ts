import { type Stop, type WeatherDay, type WeatherReport } from './journey-types';
import { tripDays } from './dates';

// Descriptions of actual provider WMO codes, not inferred from temperature or rain chance.
export function weatherCondition(code: number | null): string {
  if (code === 0) return 'Sunny';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Some clouds';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if ([51, 53, 55].includes(code ?? -1)) return 'Drizzle';
  if ([56, 57].includes(code ?? -1)) return 'Freezing drizzle';
  if ([61, 63, 65].includes(code ?? -1)) return 'Rain';
  if ([66, 67].includes(code ?? -1)) return 'Freezing rain';
  if ([71, 73, 75, 77].includes(code ?? -1)) return 'Snow';
  if ([80, 81, 82].includes(code ?? -1)) return 'Rain showers';
  if ([85, 86].includes(code ?? -1)) return 'Snow showers';
  if ([95, 96, 97, 99].includes(code ?? -1)) return 'Thunderstorms';
  return 'Conditions unavailable';
}
export function summarizeStopWeather(stop: Stop, report?: WeatherReport) {
  const days: WeatherDay[] = report?.placeId === stop.place.id ? report.days.filter((day) => day.date >= stop.arrival && day.date <= stop.departure) : [];
  const probabilities = days.flatMap((day) => day.rainProbability !== null && day.rainProbability >= 0 && day.rainProbability <= 100 ? [day.rainProbability] : []);
  const conditions = [...new Set(days.filter((day) => day.code !== null).map((day) => weatherCondition(day.code)))];
  return { days, low: days.length ? Math.min(...days.map((day) => day.low)) : null, high: days.length ? Math.max(...days.map((day) => day.high)) : null, rain: probabilities.length ? Math.max(...probabilities) : null, rainDaysCovered: probabilities.length, conditions, expectedDays: tripDays(stop.arrival, stop.departure) };
}
