import { prisma } from "../lib/prisma";

export async function upsertModerationCase(input{
  adId: string;
  userId: string;
  country?: string;
  categorySlug?: string;
  score: number;
  reasons: any;
}) {
  return prisma.moderationCase.upsert({
    where{ adId: input.adId },
    update{
      score: input.score,
      reasons: input.reasons,
      status: "OPEN",
      country: input.country,
      categorySlug: input.categorySlug,
    },
    create{
      adId: input.adId,
      userId: input.userId,
      score: input.score,
      reasons: input.reasons,
      status: "OPEN",
      country: input.country,
      categorySlug: input.categorySlug,
    },
  });
}
