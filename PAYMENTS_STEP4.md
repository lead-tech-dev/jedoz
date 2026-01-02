# Paiements (Étape 4)

Cette étape ajoute une orchestration de paiements **réels** côté backend, avec une DB source-of-truth.

## Providers
- **STRIPE** (Checkout + webhook signé)
- **MTN** (stub code-ready: callback `/payments/webhook/mtn` + polling recommandé)
- **ORANGE** (implémentation "Merchant Payment style" : `payToken` + page `/mp/pay` + polling status + webhook `/payments/webhook/orange`)
- **MOCK** (dev local: succès instantané)

## Variables d'environnement (API)
Voir `.env.example` à la racine.

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (redirections success/cancel)

### Orange Money (Cameroon-style)
- `ORANGE_BASE_URL`
- `ORANGE_AUTH_HEADER` ou `ORANGE_USERNAME` + `ORANGE_PASSWORD` (token endpoint)
- `ORANGE_MERCHANT_KEY` (si requis par votre contrat)
- `PUBLIC_API_URL` (pour construire `ORANGE_NOTIF_URL` si non fourni)
- `ORANGE_NOTIF_URL` (optionnel)

## Endpoints
- `POST /payments/init` (auth)
- `GET /payments/:id/status` (auth)
- `POST /payments/webhook/stripe` (Stripe)
- `POST /payments/webhook/mtn` (MTN)
- `POST /payments/webhook/orange` (Orange)

## Démo locale
1. Choisir provider **MOCK** sur `/packs`
2. Acheter un pack -> crédits ajoutés immédiatement

## Orange Money (sandbox/intégrateur)
- Le backend initie un paiement Orange et renvoie une `paymentUrl` (si votre contrat propose une page hébergée).
- Le front redirige vers `paymentUrl`.
- En parallèle, le front peut **poller** `GET /payments/:id/status` jusqu'à SUCCESS/FAILED.

## Stripe local (option)
Vous pouvez utiliser `stripe listen` pour forwarder les webhooks vers l'API.
