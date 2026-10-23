import { type Bag } from './journey-types';
import { canonical, quantityOf } from './packing-engine';
import { type PackingItem } from './travel-state';
export type BagLimit = { dimensions: [number, number, number] | null; linearCm: number | null; maxKg: number | null; allowed: boolean | null };
export type AirlinePolicy = { id: string; name: string; fare: string; checkedOn: string; source: string; note: string; limits: Partial<Record<Bag['type'], BagLimit>> };
export function bagFit(bag: Bag, limit?: BagLimit) {
  if (!limit) return { status: 'unknown', label: 'Limits not verified', details: ['Choose a supported fare or enter the limits from your ticket.'] };
  if (limit.allowed === false) return { status: 'over', label: 'Not included in this fare', details: ['Confirm an additional purchased allowance before bringing this bag.'] };
  const details: string[] = []; let over = false, tight = false, dimensionsKnown = false;
  if (limit.dimensions) { dimensionsKnown = true; const measured = [bag.length, bag.width, bag.depth].sort((a, b) => a - b); const maximum = [...limit.dimensions].sort((a, b) => a - b); measured.forEach((side, index) => { const margin = maximum[index] - side; if (margin < -0.001) { over = true; details.push(`A ${side} cm side exceeds the matching ${maximum[index]} cm limit.`); } else if (margin <= 1) tight = true; }); }
  if (limit.linearCm !== null) { dimensionsKnown = true; const sum = bag.length + bag.width + bag.depth; if (sum > limit.linearCm + 0.001) { over = true; details.push(`Combined dimensions ${sum.toFixed(1)} cm exceed ${limit.linearCm} cm.`); } else { details.push(`Combined dimensions ${sum.toFixed(1)} / ${limit.linearCm} cm.`); if (limit.linearCm - sum <= 2) tight = true; } }
  let weightKnown = false;
  if (limit.maxKg !== null && bag.measuredKg !== null) { weightKnown = true; if (bag.measuredKg > limit.maxKg) { over = true; details.push(`Measured ${bag.measuredKg} kg exceeds ${limit.maxKg} kg.`); } else { details.push(`Measured ${bag.measuredKg} / ${limit.maxKg} kg.`); if (limit.maxKg - bag.measuredKg <= 0.3) tight = true; } }
  else details.push(limit.maxKg === null ? 'A universal weight allowance is not verified for this fare/route.' : 'Weigh the full bag to check its weight.');
  if (!dimensionsKnown) details.push('Numeric size limits are not verified. Under-seat fit cannot be inferred.');
  if (limit.allowed === null) details.push('Whether this bag is included or purchased is not verified.');
  const unknown = !dimensionsKnown || !weightKnown || limit.allowed === null;
  return { status: over ? 'over' : unknown ? 'unknown' : tight ? 'tight' : 'fits', label: over ? 'Exceeds entered limits' : unknown ? dimensionsKnown ? 'Size checked · review weight/allowance' : 'More information needed' : tight ? 'A close fit' : 'Within entered limits', details };
}
const estimates: [RegExp, number, number][] = [[/underwear|socks/, 30, 90], [/tops|shirt|breathable/, 100, 300], [/bottoms|trousers|pants/, 250, 700], [/sleepwear|outfit/, 200, 700], [/outer layer|coat/, 500, 1500], [/mid.layer|jacket/, 250, 700], [/shoes/, 500, 1200], [/charger/, 50, 200], [/toothbrush/, 15, 50], [/toothpaste/, 50, 150], [/diapers/, 20, 60], [/hat/, 50, 180], [/bottle/, 100, 400], [/passport/, 30, 80], [/swimwear/, 80, 250]];
export function estimateBagWeight(bag: Bag, items: PackingItem[]) {
  let low = 0, high = 0, covered = 0; const assigned = items.filter((item) => item.bagId === bag.id);
  for (const item of assigned) { const known = item.unitWeightGrams; const range = estimates.find(([pattern]) => pattern.test(canonical(item.label))); if (known !== undefined) { low += known * quantityOf(item); high += known * quantityOf(item); covered++; } else if (range) { low += range[1] * quantityOf(item); high += range[2] * quantityOf(item); covered++; } }
  return { lowKg: low / 1000 + (bag.tareKg ?? 0), highKg: high / 1000 + (bag.tareKg ?? 0), covered, rows: assigned.length, includesTare: bag.tareKg !== null, allMeasured: assigned.length > 0 && assigned.every((item) => item.unitWeightGrams !== undefined) && bag.tareKg !== null };
}
