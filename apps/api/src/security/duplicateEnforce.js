import { prisma } from "../lib/prisma";
import { similarityScore, normalizeText } from "./textFingerprint";

/**
 * Enforce duplicate policy on ad create/update.
 * - If similar to recent ad by same user above threshold:
 *   - BLOCK or force PENDING_REVIEW depending env.
 */
export async function enforceDuplicatePolicy(input{
  userId: string;
  adId?: string;
  title: string;
  description: string;
}) {
  const threshold = Number(process.env.DUPLICATE_SIMILARITY_THRESHOLD ?? 0.92);
  const action = (process.env.DUPLICATE_ACTION ?? "REVIEW").toUpperCase(); // REVIEW|BLOCK|ALLOW

  const now = new Date();
  const cutoff = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14); // last 14 days

  const recent = await prisma.adFingerprint.findMany({
    where{ userId: input.userId, createdAt{ gt: cutoff }, ...(input.adId ? { adId{ not: input.adId } } {}) },
    orderBy{ createdAt: "desc" },
    take,
  });

  const current = normalizeText(`${input.title} ${input.description}`);

  let best = 0;
  for (const r of recent) {
    const score = similarityScore(current, r.fpText);
    if (score > best) best = score;
  }

  if (best >= threshold) {
    if (action === "BLOCK") {
      const err= new Error("DUPLICATE_BLOCKED");
      err.status = 400;
      err.payload = { error: "DUPLICATE_BLOCKED", similarity, threshold };
      throw err;
    }
    if (action === "REVIEW") {
      return { forceStatus: "PENDING_REVIEW", similarity: best };
    }
  }

  return { similarity: best };
}
