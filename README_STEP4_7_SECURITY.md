# Étape 4.7 — Sécurité & Anti-abus (Redis rate-limit + spam scoring + mots interdits + device/IP)

Ce zip ajoute un socle "production" pour limiter le spam et les abus :
- Rate limiting Redis (IP + user) avec stratégies par route
- Captcha (hook prêt à brancher : Cloudflare Turnstile / reCAPTCHA)
- Détection spam simple (score) + mots interdits configurables
- Blacklist IP / phone (MSISDN) / deviceId (header)
- Endpoints Admin pour gérer blacklist + keywords
- Middleware d'audit minimal (logs)

## Pré-requis
- Redis (déjà présent en étape 4.5)
- BullMQ optionnel (non requis ici)

## Variables .env (apps/api/.env)
REDIS_URL="redis://localhost:6379"
TURNSTILE_SECRET_KEY="xxx"  # optionnel si tu actives Turnstile
SECURITY_DEVICE_HEADER="x-device-id"  # utilisé par mobile/web
SPAM_KEYWORDS_DEFAULT="mineur,underage,15ans,14ans,13ans,cp,child,pedo"
SPAM_BLOCK_THRESHOLD=80
SPAM_REVIEW_THRESHOLD=50

## Intégration
1) Copie les fichiers dans ton repo en respectant l'arborescence.
2) Monte les middlewares sur les routes sensibles (auth, ads, payments).
3) (Optionnel) active Turnstile sur /auth/register et /ads (create).

## Recommandation routes
- POST /auth/register : rate-limit strict + captcha
- POST /auth/login    : rate-limit strict
- POST /ads           : rate-limit + spam scoring + blacklist checks
- POST /payments/init  : rate-limit

Voir `apps/api/src/security/presets.ts` pour des presets de rate-limit.
