# Étape 4.12 — UI Admin Boost/Monétisation (Packs crédits + Offres PRO + Boost configs + Pricing par pays)

Ce zip ajoute des pages Admin pour gérer la monétisation :
- Packs crédits (CRUD simple)
- Offres PRO (CRUD simple + actif)
- Config Boosts (CRUD simple + actif)
- Pricing par pays (table simple + override)

Pré-requis:
- API existante step1/2/3: endpoints admin pour credit packs / pro offers / boosts
- Si tes endpoints diffèrent, adapte les URLs dans `apps/admin/src/api/monetization.ts`.

Routes UI proposées:
- /admin/monetization/credit-packs
- /admin/monetization/pro-offers
- /admin/monetization/boosts
- /admin/monetization/pricing

Intégration:
1) Copier les fichiers dans apps/admin
2) Ajouter les routes dans le router admin (snippet fourni)
3) Ajouter une entrée menu "Monétisation"
