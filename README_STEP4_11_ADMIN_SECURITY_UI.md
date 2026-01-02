# Étape 4.11 — UI Admin Sécurité (Blacklist + Shadowban + Devices + Doublons)

Ce zip ajoute des pages Admin pour gérer la sécurité (Étapes 4.7 & 4.8):
- Blacklist CRUD (IP/PHONE/DEVICE) + toggle actif
- Shadowban users (activer/désactiver + raison)
- Voir devices d’un user
- Voir fingerprints/doublons d’un user (liste brute)

Pré-requis:
- API 4.7 montée: /admin/security (blacklist)
- API 4.8 montée: /admin/security-advanced (shadowbans, devices, duplicates)
- Auth staff côté admin panel

Intégration:
1) Copier les fichiers dans `apps/admin`
2) Ajouter routes dans le router admin (snippets fournis)
3) Ajouter menu "Sécurité" (selon ton layout)
