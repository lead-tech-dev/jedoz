# Cloudflare WAF rules (à copier dans le dashboard)

## 1) Challenge sur endpoints sensibles
- URI Path contains "/auth/register" -> Managed Challenge
- URI Path contains "/auth/login" -> Managed Challenge si rate-limit déclenché
- URI Path contains "/payments/init" -> Managed Challenge

## 2) Bloquer user agents suspects (optionnel)
- (http.user_agent contains "curl" and ip.src in {non-admin}) -> block

## 3) Rate limiting Cloudflare (complément à Redis)
- /auth/login : 20 req / 5 min / IP
- /auth/register : 10 req / 10 min / IP
- /ads (POST) : 30 req / 10 min / IP
- /payments/init : 20 req / 5 min / IP

## 4) Bot fight mode
Activer Bot Fight Mode (si plan compatible)

## 5) Firewall rule : bloquer pays (optionnel)
Selon stratégie (ex: bloquer régions hors cibles)

Note: on garde les règles côté serveur (Redis rate-limit) comme source de vérité, Cloudflare est un bouclier additionnel.
