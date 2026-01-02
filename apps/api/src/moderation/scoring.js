import { prisma } from "../lib/prisma";

export type ModerationInput = {
  country?: string;
  categorySlug?: string;
  title?: string;
  description?: string;
  phone?: string;
};

export type ModerationScore = {
  score: number; // 0..100
  reasons: any;  // structured
};

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\W+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitList(env) {
  return (env || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

export async function computeModerationScore(input){
  const text = normalize(`${input.title || ""} ${input.description || ""}`);
  const matches= [];
  let score = 0;

  // Base heuristics
  if (/(\bwhatsapp\b|\btelegram\b|\bsnap\b)/.test(text)) { score += 8; matches.push({ type: "heuristic", rule: "messaging_handle" }); }
  if (/(http|www)/.test(text)) { score += 12; matches.push({ type: "heuristic", rule: "links" }); }
  const digits = (text.match(/\d/g) || []).length;
  if (digits > 30) { score += 10; matches.push({ type: "heuristic", rule: "too_many_digits", digits }); }

  // Default keywords/regex from env
  const defaultKeywords = splitList(process.env.MODERATION_DEFAULT_KEYWORDS);
  for (const kw of defaultKeywords) {
    if (kw && text.includes(kw)) { score += 80; matches.push({ type: "keyword", kw, weight, source: "env_default" }); }
  }

  const defaultRegexes = (process.env.MODERATION_DEFAULT_REGEXES || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const rx of defaultRegexes) {
    try {
      const re = new RegExp(rx, "i");
      const m = text.match(re);
      if (m) { score += 40; matches.push({ type: "regex", rx, weight, source: "env_default", match: m[0] }); }
    } catch {}
  }

  // Rules from DB (country/category specific)
  const rules = await prisma.moderationRule.findMany({
    where{
      isActive,
      OR: [
        { country: input.country || undefined, categorySlug: input.categorySlug || undefined },
        { country: input.country || undefined, categorySlug: null },
        { country, categorySlug: input.categorySlug || undefined },
        { country, categorySlug: null },
      ],
    },
    take,
  });

  for (const rule of rules) {
    const weight = rule.weight ?? 10;
    for (const kw of rule.keywords || []) {
      const k = (kw || "").toLowerCase().trim();
      if (k && text.includes(k)) { score += weight; matches.push({ type: "keyword", kw, ruleId: rule.id, ruleName: rule.name }); }
    }
    for (const rx of rule.regexes || []) {
      try {
        const re = new RegExp(rx, "i");
        const m = text.match(re);
        if (m) { score += weight; matches.push({ type: "regex", rx, weight, ruleId: rule.id, ruleName: rule.name, match: m[0] }); }
      } catch {}
    }
  }

  // High risk categories/countries can add a small boost
  const strictCountry = (process.env.MODERATION_COUNTRY_STRICT || "").toUpperCase();
  const highRiskCats = splitList(process.env.MODERATION_HIGH_RISK_CATEGORIES);
  if (strictCountry && (input.country || "").toUpperCase() === strictCountry) score += 5;
  if (input.categorySlug && highRiskCats.includes(input.categorySlug.toLowerCase())) score += 5;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    reasons{
      matches,
      textPreview: text.slice(0, 240),
    },
  };
}
