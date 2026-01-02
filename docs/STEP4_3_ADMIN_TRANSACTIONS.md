# Step 4.3 — Admin Transactions + Reconciliation (MTN/ORANGE/STRIPE)

This add-on introduces:
- Admin Transactions page (filters, pagination, export CSV)
- Reconciliation page (stuck PENDING intents, re-verify)
- API endpoints under `/admin/payments/*` and `/admin/reconciliation/*`
- A `reverify` service that calls the provider-specific verify/status methods

## API Endpoints (staff JWT required)
- GET /admin/payments/intents?provider=&status=&productType=&q=&dateFrom=&dateTo=&cursor=&limit=
- GET /admin/payments/intents/:id
- GET /admin/payments/intents/:id/events
- GET /admin/payments/export.csv?provider=&status=&productType=&dateFrom=&dateTo=
- GET /admin/reconciliation/stuck?minAgeMinutes=10&provider=&limit=
- POST /admin/reconciliation/:id/reverify
- POST /admin/reconciliation/:id/cancel (sets CANCELLED when allowed)

## UI (Admin)
- /admin/payments/transactions
- /admin/payments/reconciliation

## Notes
- Export streams CSV, do not load everything into memory.
- Re-verify is idempotent: if already SUCCESS/FAILED, it returns current state without side-effects.
