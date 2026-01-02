import { Response, NextFunction } from "express";
import { computeModerationScore } from "./scoring";

/**
 * Moderation guard middleware for ad create/update.
 * - attaches req.moderationScore and req.moderationReasons
 * - forces PENDING_REVIEW when score >= review threshold
 * - blocks when score >= block threshold (optional behavior)
 */
export function moderationGuard() {
  const review = Number(process.env.MODERATION_REVIEW_THRESHOLD ?? 50);
  const block = Number(process.env.MODERATION_BLOCK_THRESHOLD ?? 85);

  return async (req, res, next) => {
    try {
      const { title, description, phone, categorySlug, country } = req.body || {};
      const { score, reasons } = await computeModerationScore({
        title, description, phone, categorySlug, country,
      });

      req.moderationScore = score;
      req.moderationReasons = reasons;

      if (score >= block) {
        return res.status(400).json({ error: "MODERATION_BLOCKED", score });
      }
      if (score >= review) {
        req.forceAdStatus = "PENDING_REVIEW";
      }
      return next();
    } catch (e) {
      return next(e);
    }
  };
}
