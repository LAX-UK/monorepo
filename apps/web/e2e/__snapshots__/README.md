# Visual regression baselines

Admin PNG baselines for [`admin-pages-visual.spec.ts`](../admin-pages-visual.spec.ts)
live under `__snapshots__/admin-pages-visual.spec.ts/`. The portfolio is curated via
[`admin-visual-cases.ts`](../admin-visual-cases.ts) and enforced by
`pnpm check:e2e-portfolio` (budget: 50 baselines).

Marketing baselines are **not committed yet**. The
[`marketing-pages-visual.spec.ts`](../marketing-pages-visual.spec.ts) spec exists for
deliberate opt-in coverage; generate snapshots only when adopting that tier:

```bash
UPDATE_MARKETING_VISUALS=1 pnpm ci:visual-baseline
```

Admin baseline updates (review every PNG diff before commit):

```bash
PLAYWRIGHT_E2E=1 PLAYWRIGHT_VISUAL=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  pnpm --filter @auction/web test:e2e:admin-visual-update
```

Use the pinned Linux/Chromium environment from
[`.github/workflows/visual-baselines.yml`](../../../../.github/workflows/visual-baselines.yml)
for CI-parity candidates.
