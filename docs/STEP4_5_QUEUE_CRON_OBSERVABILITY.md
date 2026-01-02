# Step 4.5 — BullMQ + Redis (Queue) + Cron Jobs

Cette étape ajoute une **file de jobs** (BullMQ + Redis) pour rendre les paiements **robustes** :
- webhooks rapides (réponse 2xx immédiate)
- traitements en arrière-plan (fulfillment / verify)
- **reconciliation automatique** (retry / expiration)

## 1) Services

Le `docker-compose.yml` inclut désormais :
- `db` (Postgres)
- `redis` (BullMQ)

## 2) Démarrage

### Terminal 1 (infra)
```bash
docker compose up -d db redis
```

### Terminal 2 (API)
```bash
cd apps/api
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
pnpm dev
```

### Terminal 3 (Worker)
```bash
cd apps/api
pnpm worker
```

## 3) Configuration (.env)

Voir `.env.example`.

Variables importantes :
- `REDIS_URL` (par défaut `redis://localhost:6379`)
- `PAYMENT_INTENT_TTL_MINUTES` : après combien de minutes un paiement `PENDING/INITIATED` est annulé.
- `PAYMENT_VERIFY_AFTER_MINUTES` : délai minimum avant de re-vérifier un paiement.
- `PAYMENT_VERIFY_BEFORE_MINUTES` : fenêtre max pour tenter des re-check.

## 4) Jobs installés

- `verify_pending_batch` (toutes les 2 minutes)
  - met en queue `process_intent` pour les intents STRIPE `PENDING`.
- `expire_intents` (toutes les 10 minutes)
  - annule les intents trop anciens.
- `expire_subscriptions` (toutes les 60 minutes)
  - passe PRO en `EXPIRED`.

## 5) Santé de la file

Endpoint admin:
- `GET /admin/jobs/health`

UI admin:
- `/admin/payments/jobs`

## 6) Extension MTN / ORANGE

Le worker peut être étendu pour appeler :
- MTN: `GET /collection/v1_0/requesttopay/{refId}`
- Orange: `GET /.../mp/paymentstatus/{payToken}`

et basculer l'intent en `SUCCESS/FAILED` automatiquement.
