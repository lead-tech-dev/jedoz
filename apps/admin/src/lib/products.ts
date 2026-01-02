const PRODUCT_LABELS: Record<string, string> = {
  CREDIT_PACK: 'Pack de crédits',
  PRO_SUBSCRIPTION: 'Abonnement PRO',
  BOOST: 'Boost',
};

export function formatProductType(value?: string | null) {
  if (!value) return '—';
  const key = String(value).toUpperCase();
  return PRODUCT_LABELS[key] || String(value);
}
