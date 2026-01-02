import { prisma } from "../lib/prisma";

/**
 * Returns true if user is shadow-banned.
 */
export async function isShadowBanned(userId) {
  const sec = await prisma.userSecurity.findUnique({ where{ userId } });
  return !!sec?.isShadowBanned;
}

/**
 * For public listings: exclude shadowbanned users if enabled.
 */
export function publicShadowbanFilter() {
  const enabled = (process.env.SHADOWBAN_HIDE_FROM_PUBLIC || "true").toLowerCase() === "true";
  if (!enabled) return {};
  // Prisma where snippet{ user{ security{ isShadowBanned: false } } }
  return { user{ security{ isShadowBanned: false } } };
}
