import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { moneyInputText, parseMoneyInput } from '@/lib/money';
import { palette } from '@/constants/waylo';
import { useCurrency } from './currency-provider';
import { Text } from './language-provider';
import { j, TextAction } from './journey-ui';
import { ui } from './travel-ui';

export function CurrencyNotice({ settingsLink = true }: { settingsLink?: boolean }) {
  const money = useCurrency(); const fallback = money.currency !== money.effectiveCurrency;
  return <View style={{ gap: 4 }}>
    <Text accessibilityLiveRegion="polite" style={ui.small}>{fallback ? `${money.currency} conversion ${money.loading ? 'is loading' : 'is unavailable'}. Showing original USD amounts.` : money.currency === 'USD' ? 'Amounts shown in USD.' : `Approximate ${money.currency} amounts · ${money.stale ? 'Saved rates are stale' : 'Rate date'} ${money.report ? new Date(money.report.updatedAt).toLocaleDateString(money.locale) : 'unavailable'}.`}</Text>
    {!!money.error && <Text style={ui.error}>{money.error}</Text>}
    {money.effectiveCurrency !== 'USD' && <Text style={ui.small}>Indicative planning estimates; card and bank rates may differ.</Text>}
    <View style={j.wrap}>{settingsLink && <TextAction label={`Country & currency · ${money.currency}`} onPress={() => router.push('/currency')} />}{money.report && money.effectiveCurrency !== 'USD' && <TextAction label="Rates by ExchangeRate-API" onPress={() => void Linking.openURL('https://www.exchangerate-api.com').catch(() => undefined)} />}</View>
  </View>;
}

/** Values passed to the parent remain USD. A focused field freezes its rate and currency. */
export function MoneyField({ label, value, onChange, hint }: { label: string; value: number; onChange: (usd: number) => void; hint?: string }) {
  const money = useCurrency(); const [editing, setEditing] = useState<{ currency: string; rate: number; locale: string } | null>(null); const [text, setText] = useState('');
  const input = editing ?? { currency: money.effectiveCurrency, rate: money.rate, locale: money.inputLocale }; const fullLabel = `${label} (${input.currency})`;
  return <View style={j.field}><Text style={ui.label}>{fullLabel}</Text><TextInput accessibilityLabel={fullLabel} value={editing ? text : moneyInputText(value, input.rate, input.locale, input.currency)} keyboardType="decimal-pad" maxLength={20} placeholderTextColor={palette.muted} style={ui.input}
    onFocus={() => { setEditing(input); setText(moneyInputText(value, input.rate, input.locale, input.currency)); }}
    onChangeText={(next) => { setText(next); const local = parseMoneyInput(next, input.locale); onChange(local / input.rate); }}
    onBlur={() => setEditing(null)} />{hint && <Text style={ui.small}>{hint}</Text>}
    <Text style={ui.small}>{input.currency === 'USD' ? money.currency !== 'USD' ? `No usable ${money.currency} rate. Enter USD; your selection is kept for later.` : 'Entered in USD.' : `Entered in ${input.currency}; converted to the app’s USD base using the rate shown above. Unchanged amounts keep their original precision.`}</Text>
  </View>;
}
