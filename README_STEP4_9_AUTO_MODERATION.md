# Étape 4.9 — Auto-modération avancée (scoring + high-risk queue + workflow modérateur)

Objectif :
- Détecter automatiquement les contenus à risque (plateforme adulte)
- Mettre en file les annonces "HIGH_RISK" pour revue
- Appliquer des règles par pays/catégorie (mots interdits, patterns, score)
- Donner aux modérateurs un workflow rapide : approve / reject / escalate

Contenu du zip :
- Modèles Prisma (snippets) : ModerationRule, ModerationCase, ModerationDecision
- Service de scoring rule-based (0..100) : keywords + regex + heuristiques
- Middleware à brancher sur POST/PUT /ads : calcule score, force status PENDING_REVIEW si nécessaire, crée un ModerationCase
- API Admin : lister les cases, voir détails, décider (approve/reject/escalate)
- (Optionnel) Job BullMQ : re-score des annonces / nettoyage des cases

## Variables .env
MODERATION_REVIEW_THRESHOLD=50
MODERATION_BLOCK_THRESHOLD=85
MODERATION_DEFAULT_KEYWORDS="mineur,underage,15ans,14ans,13ans,child,pedo"
MODERATION_DEFAULT_REGEXES="\b(\d{1,2})\s?ans\b"
MODERATION_HIGH_RISK_CATEGORIES="rencontres,escorts"
MODERATION_COUNTRY_STRICT="CM"

## Intégration (dans ton projet)
1) Copier les fichiers dans le repo en respectant l'arborescence
2) Ajouter les modèles Prisma (snippets) dans `apps/api/prisma/schema.prisma`
3) `pnpm prisma:migrate` (nom: step4_9_auto_moderation) + `pnpm prisma:generate`
4) Monter les routes admin: `/admin/moderation`
5) Brancher `moderationGuard()` sur POST/PUT /ads (avant création DB)
