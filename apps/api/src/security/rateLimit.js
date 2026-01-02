import { redis } from "./redis.js";
import { rateLimitPresets } from "./presets.js";

/**
 * Redis rate limit middleware (IP + optional userId).
 * Key pattern: rl:<scope>:<id>
 */
export function rateLimit(scope, preset) {
  return async (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const userId = req.user?.id || "anon";
    const key = `rl:${scope}:${ip}:${userId}`;

    const now = Date.now();
    const windowMs = preset.windowSeconds * 1000;

    // Sliding window: store timestamps in a sorted set
    const zkey = key;
    const cutoff = now - windowMs;

    try {
      const multi = redis.multi();
      multi.zremrangebyscore(zkey, 0, cutoff);
      multi.zadd(zkey, now, String(now));
      multi.zcard(zkey);
      multi.pexpire(zkey, windowMs + 5000);

      const [, , cardRes] = await multi.exec();
      const count = Number(cardRes?.[1] ?? 0);

      res.setHeader("X-RateLimit-Limit", String(preset.max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, preset.max - count)));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((cutoff + windowMs) / 1000)));

      if (count > preset.max) {
        return res.status(429).json({ error: "RATE_LIMITED", scope, retryAfterSeconds: preset.windowSeconds });
      }
      next();
    } catch {
      next();
    }
  };
}

export const rateLimitRegister = rateLimit("auth_register", rateLimitPresets.AUTH_REGISTER);
export const rateLimitLogin = rateLimit("auth_login", rateLimitPresets.AUTH_LOGIN);
export const rateLimitAdsCreate = rateLimit("ads_create", rateLimitPresets.ADS_CREATE);
export const rateLimitPaymentsInit = rateLimit("payments_init", rateLimitPresets.PAYMENTS_INIT);
