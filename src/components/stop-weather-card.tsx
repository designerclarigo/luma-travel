import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './language-provider';
import { MotionPressable } from './motion-pressable';
import { Icon, ui } from './travel-ui';
import { j, TextAction } from './journey-ui';
import { palette, typography } from '@/constants/waylo';
import { type Stop, type WeatherDay, type WeatherReport } from '@/lib/journey-types';
import { dateLabel, localDate } from '@/lib/dates';
import { cacheIsFresh, climateForStop, temperatureLabel } from '@/lib/weather';
import { summarizeStopWeather, weatherCondition } from '@/lib/weather-summary';

export function StopWeatherCard({ stop, report, unit, loading, onHours }: { stop: Stop; report?: WeatherReport; unit: 'C' | 'F'; loading: boolean; onHours: (day: WeatherDay, timezone: string) => void }) {
  const [expanded, setExpanded] = useState(false); const summary = summarizeStopWeather(stop, report); const normal = expanded ? climateForStop(stop) : null;
  const toggle = () => setExpanded((value) => !value);
  return <View style={s.card}>
    <MotionPressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} weather for ${stop.place.name}`} accessibilityState={{ expanded }} onPress={toggle} style={s.header}>
      <View style={s.symbol}><Icon name="cloud" size={24} /></View><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={j.kicker}>{report ? cacheIsFresh(report) ? 'SAVED FORECAST' : 'STALE SAVED FORECAST' : 'WEATHER AHEAD'}</Text><Text localize={false} style={j.title}>{stop.place.name}</Text></View><View style={{ transform: [{ rotate: expanded ? '270deg' : '90deg' }] }}><Icon name="chevron" size={16} /></View>
    </MotionPressable>
    <Text style={ui.small}>{dateLabel(stop.arrival)} – {dateLabel(stop.departure)}</Text>
    {(stop.place.kind === 'country' || stop.place.kind === 'region') && <Text style={ui.small}>Forecast for the provider’s reference point ({stop.place.latitude.toFixed(3)}°, {stop.place.longitude.toFixed(3)}°), not the whole {stop.place.kind}. Add specific cities for local forecasts.</Text>}
    {loading && <View accessibilityLiveRegion="polite" style={s.loading}><ActivityIndicator size="small" color={palette.pine} /><Text style={[ui.small, { flex: 1 }]}>Updating this forecast… Saved data stays available.</Text></View>}
    {summary.days.length > 0 ? <>
      <View style={s.metrics}><View style={s.metric}><Text style={s.temperature}>{temperatureLabel(summary.low!, unit)} – {temperatureLabel(summary.high!, unit)}</Text><Text style={ui.small}>Temperature range</Text></View><View style={s.metric}><Text style={s.rain}>{summary.rain === null ? 'Unavailable' : `Up to ${summary.rain}%`}</Text><Text style={ui.small}>Daily rain chance</Text></View></View>
      <Text style={s.conditions}>{summary.conditions.length ? summary.conditions.slice(0, 3).join(' · ') + (summary.conditions.length > 3 ? ' · more below' : '') : 'Conditions unavailable'}</Text>
      <Text style={ui.small}>{summary.days.length} of {summary.expectedDays} travel days covered{summary.rainDaysCovered < summary.days.length ? ' · Rain probability is missing on some days.' : ''}</Text>
    </> : <Text style={ui.body}>{stop.departure < localDate() ? 'A current forecast cannot describe a past trip.' : report?.days.length ? `Your dates are outside the saved forecast (${dateLabel(report.days[0].date)}–${dateLabel(report.days.at(-1)!.date)}).` : 'No forecast saved yet. Check real forecasts while online.'}</Text>}
    {report && <Text style={ui.small}>Last updated {new Date(report.fetchedAt).toLocaleString()} · Open-Meteo{!cacheIsFresh(report) ? '\nThis saved forecast is stale. Refresh when you’re online.' : ''}</Text>}
    {expanded && <View style={s.details}>
      <Text style={ui.small}>Destination time zone: {report?.timezone ?? stop.place.timezone}. Rain percentages are daily probabilities, not a probability for the entire trip.</Text>
      {stop.departure < localDate() && report && <Text style={ui.small}>Previously saved forecast, not observed historical weather.</Text>}
      {summary.days.map((day) => <View key={day.date} style={s.day}><View style={s.between}><Text style={ui.label}>{dateLabel(day.date)}</Text><Text style={ui.label}>{temperatureLabel(day.low, unit)} – {temperatureLabel(day.high, unit)}</Text></View><Text style={ui.body}>{weatherCondition(day.code)}</Text><Text style={ui.small}>{day.rainProbability === null || day.rainProbability < 0 || day.rainProbability > 100 ? 'Rain probability unavailable' : `${day.rainProbability}% rain probability`}{day.rainMm === null ? '' : ` · ${day.rainMm} mm`}</Text>{day.hours.length > 0 && <TextAction label={`Hourly weather for ${stop.place.name} on ${day.date}`} onPress={() => onHours(day, report!.timezone)} />}</View>)}
      {normal && summary.days.length < summary.expectedDays ? <View style={j.note}><Text style={j.kicker}>SEASONAL AVERAGES · NOT A FORECAST</Text>{normal.months.map((month) => <View key={month.month} style={{ gap: 4 }}><Text style={ui.label}>{new Date(2020, month.month - 1, 1).toLocaleDateString(undefined, { month: 'long' })}: {temperatureLabel(month.low, unit)} – {temperatureLabel(month.high, unit)}</Text><Text style={ui.small}>About {month.rainDays} days/month with at least 1 mm precipitation.</Text></View>)}<Text style={ui.small}>{normal.period} · {normal.model} reanalysis via Open-Meteo · retrieved {new Date(normal.retrievedAt).toLocaleDateString()}. These are monthly averages.</Text></View> : !summary.days.length && <Text style={ui.small}>Offline climate data is unavailable here. Set expected conditions in Packing preferences instead of assuming mild weather.</Text>}
    </View>}
    <TextAction label={expanded ? `Hide forecast details for ${stop.place.name}` : `View forecast details for ${stop.place.name}`} onPress={toggle} />
  </View>;
}
const s = StyleSheet.create({
  card: { padding: 16, borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, gap: 12 },
  header: { minHeight: 56, flexDirection: 'row', gap: 12, alignItems: 'center' }, symbol: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 8 }, metric: { flexGrow: 1, gap: 4 },
  temperature: { fontFamily: typography.editorial, fontSize: 29, lineHeight: 34, color: palette.pine }, rain: { fontFamily: typography.medium, fontSize: 20, lineHeight: 34, color: palette.pine },
  conditions: { fontFamily: typography.medium, fontSize: 15, lineHeight: 23, color: palette.ink }, loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  details: { gap: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  day: { gap: 8, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, between: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
});
