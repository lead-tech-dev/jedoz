/**
 * Simple spam scoring (rule-based). Returns 0..100.
 */
export function computeSpamScore(input{ title?: string; description?: string; phone?: string }) {
  const text = `${input.title || ""} ${input.description || ""}`.toLowerCase();

  let score = 0;

  // suspicious tokens
  if (/(\bwhatsapp\b|\btelegram\b|\bsnap\b)/.test(text)) score += 10;
  if (/(http:\/\/|https:\/\/|www\.)/.test(text)) score += 15;
  if (/\bgratuit\b|\bfree\b/.test(text)) score += 5;

  // many digits -> spam
  const digits = (text.match(/\d/g) || []).length;
  if (digits > 20) score += 10;
  if (digits > 40) score += 15;

  // repeated characters
  if (/(.)\1{7,}/.test(text)) score += 10;

  // keyword blocklist
  const defaults = (process.env.SPAM_KEYWORDS_DEFAULT || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const kw of defaults) {
    if (kw && text.includes(kw)) score += 80; // hard block keywords
  }

  // phone in body can be a signal
  if (input.phone && input.phone.length >= 8) score += 5;

  return Math.min(100, score);
}
