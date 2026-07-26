# Admin browser stabilization gate

The rollout gate requires a running web/API stack on `http://localhost:3000` and seeded staff data.

Use **Node.js 22** (matches CI and Playwright tooling in this repo).

```bash
PLAYWRIGHT_E2E=1
PLAYWRIGHT_BASE_URL=http://localhost:3000
PLAYWRIGHT_STAFF_EMAIL=admin@lax.bid
PLAYWRIGHT_STAFF_PASSWORD=Password123!
PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL=staff-catalogue@lax.bid
PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD=Password123!
PLAYWRIGHT_BUYER_EMAIL=estate-owner@lax.bid
PLAYWRIGHT_BUYER_PASSWORD=Password123!
```

Run functional and accessibility coverage:

```bash
pnpm --filter @auction/web test:e2e:stabilization
```

Generate or update admin visual baselines against a production build:

```bash
PLAYWRIGHT_VISUAL=1 pnpm --filter @auction/web test:e2e:admin-visual-update
```

Visual snapshots cover desktop/mobile and light/dark variants, including `/admin/payouts` and
`/admin/payouts/settlement`. Keep visual updates manual until the baseline is reviewed and stable;
functional and serious/critical axe tests are suitable for CI once the seeded test stack is available.
