# Visual regression baselines

PNG baselines for [`marketing-pages-visual.spec.ts`](../marketing-pages-visual.spec.ts) live under `__snapshots__/marketing-pages-visual.spec.ts/` (see `snapshotPathTemplate` in [`playwright.config.ts`](../playwright.config.ts)).

Generate or refresh them after UI changes:

1. Build and start the app (e.g. `pnpm --filter @auction/web build` then `pnpm --filter @auction/web start -- -p 3030 -H 127.0.0.1`).
2. From `apps/web`, run:

   ```bash
   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3030 pnpm run test:e2e:visual-update
   ```

3. Commit the updated PNGs under `e2e/__snapshots__/`.

Tests are gated with `PLAYWRIGHT_E2E=1` and `PLAYWRIGHT_VISUAL=1` (see the spec file).
