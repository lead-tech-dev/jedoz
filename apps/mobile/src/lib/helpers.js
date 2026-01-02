export function currencyFmt(amount, currency = 'XAF') {
  if (amount === null || amount === undefined) return '-';
  return `${amount} ${currency}`;
}

export function toTitleCase(value) {
  return String(value || '')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function fallbackLocation(ad, fallback) {
  if (typeof ad?.lat === 'number' && typeof ad?.lng === 'number') {
    return { latitude: ad.lat, longitude: ad.lng };
  }
  const loc = ad?.dynamic?.location || ad?.dynamic?.geo;
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return { latitude: loc.lat, longitude: loc.lng };
  }
  return fallback;
}

export function buildQuery(params) {
  const parts = [];
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}
