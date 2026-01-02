import { Response, NextFunction } from "express";
import { computeSpamScore } from "./spamScore";

/**
 * Enforce spam score policy for ad creation/update.
 * - >= BLOCK: reject
 * - >= REVIEW: mark pending_review (if your system supports it)
 */
export function enforceSpamPolicy() {
  const block = Number(process.env.SPAM_BLOCK_THRESHOLD ?? 80);
  const review = Number(process.env.SPAM_REVIEW_THRESHOLD ?? 50);

  return (req, res, next) => {
    const { title, description, phone } = req.body || {};
    const score = computeSpamScore({ title, description, phone });

    req.spamScore = score;

    if (score >= block) {
      return res.status(400).json({ error: "SPAM_BLOCKED", score });
    }

    // If your ads create endpoint supports status override:
    if (score >= review) {
      req.forceAdStatus = "PENDING_REVIEW";
    }

    next();
  };
}
