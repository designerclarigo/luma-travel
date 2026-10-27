export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const text = (value, fallback = 'Not set') => typeof value === 'string' && value.trim() ? value : fallback;
export const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? new Intl.NumberFormat().format(value) : '—';
export function userIdentity(user = {}) {
  const name = text(user.full_name, ''); const email = text(user.email, 'Email not provided');
  const words = (name || email).trim().split(/\s+/);
  const initials = [Array.from(words[0] || 'W')[0], ...(words.length > 1 ? [Array.from(words.at(-1))[0]] : [])].join('').toLocaleUpperCase();
  return { name, email, displayName: name || email, initials, homeCity: text(user.home_city, 'Not provided') };
}
export function date(value, time = false) {
  if (!value || typeof value !== 'string') return 'Not set';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(parsed);
}
export const usd = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : 'Not set';
export function packingCount(item) {
  const quantity = item.quantity === undefined ? 1 : item.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return null;
  const packed = item.packed === true ? quantity : Math.max(0, Math.min(quantity, Number.isInteger(item.packedCount) ? item.packedCount : 0));
  return { quantity, packed, complete: packed === quantity };
}
export function packingProgress(items) {
  let total = 0; let packed = 0; let invalid = 0;
  for (const item of items) { const count = item && packingCount(item); if (!count) { invalid++; continue; } total += count.quantity; packed += count.packed; }
  return { total, packed, percent: total ? Math.round(packed / total * 100) : 0, invalid };
}
export function filterPacking(items, query, status) {
  return items.filter((item) => {
    if (!item || !text(item.label, '').toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    const count = packingCount(item);
    return status === 'all' || status === 'packed' && count?.complete || status === 'remaining' && count && !count.complete;
  });
}
