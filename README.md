# Jedolo-like Clone (Monorepo)

This repo contains 4 apps:
- `apps/web`: public website + user dashboard
- `apps/admin`: back-office admin
- `apps/mobile`: Expo React Native (skeleton)
- `apps/api`: Node/Express API (stub)

## Quick start

### 1) Install deps
```bash
pnpm install
```

### 2) Run apps
```bash
pnpm dev:web
pnpm dev:admin
pnpm dev:api
pnpm dev:mobile
```

## Notes
- UI is intentionally simple but “Jedolo-inspired”: dark header, search bar, listing cards, VIP/URGENT/TOP badges.
- Replace the API stub with NestJS/Prisma when ready (structure already split into modules).
