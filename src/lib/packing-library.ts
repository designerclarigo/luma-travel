import { type PackingTemplate } from './journey-types';
import { canonical, packedOf, quantityOf } from './packing-engine';
import { type PackingItem, type Trip, uniqueId } from './travel-state';

export function templateFromTrip(trip: Trip, name: string, fromPast = false): PackingTemplate {
  if (!name.trim()) throw new Error('Give this template a name.');
  const byName = new Map<string, PackingTemplate['items'][number]>();
  for (const item of trip.packing) {
    if (fromPast && /boarding|ticket|reservation/i.test(item.label)) continue;
    const key = `${canonical(item.label)}:${item.categoryId ?? 'extras'}`; const old = byName.get(key);
    byName.set(key, { label: item.label, categoryId: item.categoryId ?? 'extras', quantity: Math.max(quantityOf(item), old?.quantity ?? 0), notes: item.notes ?? '', essential: !!item.essential || !!old?.essential });
  }
  return { id: uniqueId(), name: name.trim(), categories: trip.packingCategories.map((c) => ({ ...c })), items: [...byName.values()] };
}
export function applyTemplate(trip: Trip, template: PackingTemplate, ownerId: string): Trip {
  const categories = trip.packingCategories.map((category) => ({ ...category })); const categoryIds = new Map<string, string>();
  for (const category of template.categories) {
    const existing = categories.find((item) => canonical(item.name) === canonical(category.name));
    const id = existing?.id ?? `category-${uniqueId()}`; if (!existing) categories.push({ id, name: category.name }); categoryIds.set(category.id, id);
  }
  const items = trip.packing.map((item) => ({ ...item }));
  for (const item of template.items) {
    const existing = items.find((value) => canonical(value.label) === canonical(item.label) && value.ownerId === ownerId);
    if (existing) { const packedCount = packedOf(existing); const legacyOverride = existing.edited && !existing.overrides; existing.quantity = Math.max(quantityOf(existing), item.quantity); existing.packedCount = packedCount; existing.packed = packedCount === existing.quantity; existing.essential ||= item.essential; existing.edited = true; if (!legacyOverride) existing.overrides = [...new Set([...(existing.overrides ?? []), 'quantity', 'essential'])]; }
    else items.push({ ...item, id: uniqueId(), ownerId, categoryId: categoryIds.get(item.categoryId) ?? 'extras', packed: false, packedCount: 0, edited: true });
  }
  return { ...trip, packingCategories: categories, packing: items };
}
export function removeCategory(trip: Trip, id: string): Trip {
  if (id === 'extras') throw new Error('Keep Little extras as a home for uncategorized items.');
  return { ...trip, packingCategories: trip.packingCategories.filter((category) => category.id !== id), packing: trip.packing.map((item) => item.categoryId === id ? { ...item, categoryId: 'extras', edited: true, overrides: item.edited && !item.overrides ? undefined : [...new Set([...(item.overrides ?? []), 'categoryId'])] } : item) };
}
export function editedItem(original: PackingItem | undefined, next: PackingItem): PackingItem {
  const fields = ['label', 'quantity', 'categoryId', 'ownerId', 'notes', 'essential', 'unitWeightGrams'] as const;
  const overrides = [...new Set([...(original?.overrides ?? []), ...fields.filter((key) => original?.[key] !== next[key])])];
  return { ...next, edited: true, overrides: original?.edited && !original.overrides ? undefined : overrides };
}
