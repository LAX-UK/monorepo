# Production go-live sign-off (lax.bid)

Use this checklist when promoting from test to production. Run top to bottom; do not skip CORS verification after API deploy.

## Automated checks (run locally or in CI)

```bash
# Test environment (after test deploy)
bash scripts/verify-go-live-cors.sh https://test-api.lax.bid https://test.lax.bid

# Production (after prod deploy)
bash scripts/verify-go-live-cors.sh https://api.lax.bid https://lax.bid
```

Health (all components):

```bash
curl -sf https://api.lax.bid/health/ready | jq .
curl -sf https://lax.bid/api/health/live  # if exposed via web
```

## Deploy sequence

| Step | Action | Owner sign-off |
|------|--------|----------------|
| 1 | Merge to `main` → auto deploy to **test** (`.github/workflows/app-deploy-test.yml`) | |
| 2 | `verify-go-live-cors.sh` passes on test-api | |
| 3 | Manual smoke on test.lax.bid (below) | |
| 4 | Complete integrations checklist (below) | |
| 5 | Promote same git ref to **prod** (push `release` or DO console — see [deploy-checklist.md](./deploy-checklist.md)) | |
| 6 | Migration job succeeds before traffic | |
| 7 | `verify-go-live-cors.sh` passes on api.lax.bid | |
| 8 | Prod smoke matrix (below) | |

## Integrations (complete before prod traffic)

### Veriff KYC (live)

- [ ] Live `VERIFF_API_KEY` + `VERIFF_SHARED_SECRET` in prod App Platform secrets
- [ ] Webhooks: `POST https://api.lax.bid/webhooks/veriff/decision` (+ optional `/event`)
- [ ] Sandbox keys removed from prod
- [ ] Smoke: new user completes InContext → `kycStatus=approved` after webhook

See [kyc-veriff-e2e-checklist.md](./kyc-veriff-e2e-checklist.md) (adapt URLs to prod).

### Stripe Connect + Checkout (live)

- [ ] Live Stripe keys and four webhook destinations configured
- [ ] `STRIPE_*_MAX` tier env vars set
- [ ] Test webhook delivery returns 200

See [stripe-connect-go-live.md](./stripe-connect-go-live.md).

### Auth

- [ ] OAuth redirect URIs include `https://lax.bid`
- [ ] `COOKIE_DOMAIN=.lax.bid`, `WEB_ORIGIN=https://lax.bid`, `VERIFY_ORIGIN=true`
- [ ] Sign-in, sign-out, session refresh work on prod

See [auth-go-live-rollout.md](./auth-go-live-rollout.md).

## Test smoke matrix (test.lax.bid)

Buyer account: KYC **approved**, valid acting legal entity cookie if multi-entity.

- [ ] Sign in → dashboard loads
- [ ] Active lot → place bid ≥ min increment → success (no stuck "Submitting…")
- [ ] Set and clear auto-bid
- [ ] Add and remove watchlist item
- [ ] Browser devtools: no CORS errors on `/bids` or watchlist calls

## Production smoke matrix (lax.bid)

Same as test smoke, plus:

- [ ] KYC flow uses Veriff **live** (not sandbox UI)
- [ ] Won-lot Collection → Stripe Checkout redirect (card tier test if available)

## Post-launch (first 24h)

- [ ] Post deploy note in on-call channel with short SHA
- [ ] Watch Sentry for `/bids`, Veriff, Stripe webhook errors
- [ ] Rollback plan confirmed (DO one-click rollback)

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | CORS + deploy verified |
| Product/Ops | | | Smoke matrix passed |
| Finance (if payouts live) | | | Stripe Connect checklist |
