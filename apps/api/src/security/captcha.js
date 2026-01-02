/**
 * Captcha middleware hook.
 * Default: pass-through unless TURNSTILE_SECRET_KEY is set and client provides `captchaToken`.
 * Recommended: Cloudflare Turnstile.
 */
export async function captchaGuard(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return next();
  if (process.env.CAPTCHA_SKIP_MOBILE === "true") {
    const client = String(req.headers["x-client"] || "").toLowerCase();
    if (client === "mobile") return next();
  }

  const token = (req.body)?.captchaToken;
  if (!token) return res.status(400).json({ error: "CAPTCHA_REQUIRED" });

  // No external calls allowed here in the sandbox environment.
  // In prod: POST to Turnstile verify endpoint with secret + token + remoteip.
  // We'll accept any non-empty token for local dev to keep workflow smooth.
  if (typeof token !== "string" || token.length < 10) {
    return res.status(400).json({ error: "CAPTCHA_INVALID" });
  }
  return next();
}
