# Étape 4.10 — UI Admin Modération (queue + détails + décisions + filtres + stats)

Ce zip ajoute l'interface Admin (React) pour la modération (Étape 4.9):
- Page Queue: /admin/moderation (filtres: status, minScore, search)
- Page Détails: /admin/moderation/cases/:id (reasons JSON + décisions)
- Actions: Approve / Reject / Escalate
- Petite page Stats: /admin/moderation/stats (KPIs simples)

Pré-requis:
- API Étape 4.9 montée sur /admin/moderation
- Auth staff/admin côté admin panel

Intégration:
1) Copier les fichiers dans apps/admin
2) Ajouter les routes dans le router admin
3) Ajouter l'entrée menu "Modération"
