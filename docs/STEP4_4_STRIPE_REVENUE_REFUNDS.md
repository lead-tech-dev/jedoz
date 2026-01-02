# Step 4.4 — Stripe (prod-grade) + Revenue/Refunds Admin

## Backend (apps/api)

### Stripe webhook (signature + idempotence)
Route:
- `POST /payments/webhook/stripe` (raw body)

Features:
- Verifies `STRIPE_WEBHOOK_SECRET`
- Stores events in `PaymentEvent` with unique `(provider,eventId)`
- Handles:
  - `checkout.session.completed` → `PaymentIntent=SUCCESS` + stores `stripePaymentIntentId` + fulfillment
  - `checkout.session.expired` → `CANCELLED`
  - `payment_intent.payment_failed` → `FAILED`
  - `charge.refunded` → `REFUNDED`

### Admin APIs
All require `Authorization: Bearer <admin_token>` (admin or moderator).

- `GET /admin/payments/intents` (filters + cursor)
- `GET /admin/payments/intents/:id` (details + last events)
- `GET /admin/payments/export.csv`
- `GET /admin/payments/revenue?from&to`
- `POST /admin/payments/intents/:id/refund` (Stripe only)

Reconciliation:
- `GET /admin/reconciliation/stuck?minutes=15&provider=STRIPE`
- `POST /admin/reconciliation/:id/reverify`
- `POST /admin/reconciliation/:id/cancel`

## Admin UI (apps/admin)

Pages:
- `/admin/payments/transactions`
- `/admin/payments/reconciliation`
- `/admin/payments/revenue`
- `/admin/payments/refunds`

## Env

API:
```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
