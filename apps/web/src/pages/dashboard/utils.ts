export function currencyFmt(amount: number, currency: string, locale = 'fr-FR') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function tone(s: string) {
  const S = String(s).toUpperCase();
  if (S === 'PUBLISHED') return 'ok';
  if (S === 'PENDING_REVIEW') return 'warn';
  if (S === 'REJECTED' || S === 'SUSPENDED') return 'danger';
  return 'neutral';
}
