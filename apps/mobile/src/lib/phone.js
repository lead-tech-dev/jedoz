export function normalizeCameroonPhone(input) {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00237')) digits = digits.slice(5);
  else if (digits.startsWith('237')) digits = digits.slice(3);
  if (digits.length !== 9) return null;
  if (!digits.startsWith('6')) return null;
  return `237${digits}`;
}

export function isValidCameroonPhone(input) {
  return !!normalizeCameroonPhone(input);
}
