# Demo readiness evidence (test)

Automated browser rehearsals for the demo checklist live in
[`apps/shop/e2e/demo-readiness-test.spec.ts`](../../../apps/shop/e2e/demo-readiness-test.spec.ts).

## Run locally (against test)

```bash
export DEMO_READINESS_TEST=1
export PLAYWRIGHT_BASE_URL=https://test-shop.lax.bid
export AUTH_BASE_URL=https://test-auth.lax.bid
export BID_WEB_ORIGIN=https://test.lax.bid
export IDENTITY_ACCEPTANCE_EMAIL='…'
export IDENTITY_ACCEPTANCE_PASSWORD='…'
export POSTMARK_SERVER_TOKEN='…'   # required for sign-up email step

pnpm --filter @auction/shop exec playwright install chromium
pnpm --filter @auction/shop exec playwright test e2e/demo-readiness-test.spec.ts --project=chromium-desktop
```

Screenshots are written under `docs/evidence/demo-readiness-test/screenshots/`.

## CI

Workflow [`.github/workflows/demo-readiness-test-rehearsal.yml`](../../../.github/workflows/demo-readiness-test-rehearsal.yml)
(warm-up → backup account verification → Playwright → optional rehearsal user delete).

Download the `demo-readiness-screenshots-*` artifact from the run for the four proof images.

Latest rehearsal run (partial green): [36605627093](https://github.com/LAX-UK/monorepo/actions/runs/36605627093)
— Postmark sign-up + cross-product Shop sign-in passed; checkout/logout steps may need
`SILENT_SSO_ENABLED` / shop immutable deploy for full parity.
