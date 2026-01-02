/**
 * Lightweight text fingerprint (normalization + hash).
 * Use this to detect near-duplicate ads.
 */
import crypto from "crypto";

export function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\W+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textFingerprint(title, description) {
  const norm = normalizeText(`${title} ${description}`);
  // SHA1 is fine for fingerprinting (not for crypto security)
  const hash = crypto.createHash("sha1").update(norm).digest("hex");
  return { norm, hash };
}

/**
 * Similarity score based on trigram Jaccard (0..1)
 */
export function trigramSet(s) {
  const a = new Set<string>();
  const t = normalizeText(s);
  for (let i = 0; i < Math.max(0, t.length - 2); i++) a.add(t.slice(i, i + 3));
  return a;
}

export function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

export function similarityScore(a, b) {
  return jaccard(trigramSet(a), trigramSet(b));
}
