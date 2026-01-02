# Étape 4.8 — Sécurité avancée (WAF/Cloudflare + anti-doublons + shadow-ban + device fingerprint)

Ce zip ajoute des briques "production" supplémentaires :
1) Recommandations WAF (Cloudflare) + règles prêtes à copier
2) Device fingerprint (light) + association user<->device
3) Anti-doublons annonces (fingerprint texte + seuil similarité) pour bloquer ou mettre en review
4) Shadow-ban (soft ban) : l'utilisateur peut publier, mais ses annonces ne sortent plus publiquement
5) Admin endpoints : gérer shadowban, voir devices, voir doublons suspects

## Pré-requis
- Redis (optionnel pour cache), Prisma
- Étape 4.7 (rate limit + blacklist) recommandée

## Variables .env
SECURITY_DEVICE_HEADER="x-device-id"
DUPLICATE_SIMILARITY_THRESHOLD=0.92
DUPLICATE_ACTION="REVIEW"   # REVIEW|BLOCK|ALLOW
SHADOWBAN_HIDE_FROM_PUBLIC=true

## Intégration
- Copier les fichiers dans ton repo.
- Ajouter les modèles Prisma (snippets fournis) puis `pnpm prisma:migrate`.
- Monter les middlewares sur `POST /ads` (anti-doublons) et sur les listings publics (shadow-ban filter).

---
