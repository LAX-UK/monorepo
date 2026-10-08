# Shop staging: deploy DB readiness failures

Use when **App deploy test** fails during App Platform rollout with **shop-api**
`/health/ready` **503** (`shop catalogue schema is not ready`) or Postgres
`permission denied for table shop_*` in shop-api logs.

## Symptoms (example: run 37779149645)

- App Platform deployment ends in phase **ERROR** while **migrate** logs
  `Migrations applied.` later in the same deployment window.
- shop-api readiness returns **503** until catalogue schema checks pass.
- Scheduler logs show **`permission denied for table shop_order`** (and related
  shop tables) for the **shop-api runtime DB role**.

## Likely causes

1. **Ordering:** shop-api health checks run before the **PRE_DEPLOY migrate** job
   finishes applying shop catalogue migrations (see
   [06-deployment.md](../architecture/06-deployment.md) migrate job binding in
   `digitalocean-app` Terraform).
2. **Grants:** migrate runs as owner; shop-api uses a restricted role. New shop
   tables or migrations must **`GRANT`** privileges to the shop-api DB user in
   auction-infra / migrate image (not fixed by monorepo pipeline PRs alone).

## Checks

1. In App Platform deployment logs, compare **migrate** `PRE_DEPLOY` step timing
   vs **shop-api** `/health/ready` probe failures.
2. On test Postgres, as superuser: confirm the shop-api role can
   `SELECT`/`INSERT`/… on `shop_order`, `shop_artwork_interest`,
   `shop_identity_merge_inbox`, etc.
3. Confirm **unrelated deploys** (CI-only `main` commits) are not triggering full
   rollouts — use the classifier + narrowed `app-deploy-test` path filters.

## Mitigation

- **Pipeline:** only deploy when `resolve-affected-deploy-components` reports
  affected image components; do not pin unchanged shop tags on unrelated commits.
- **Platform:** fix PRE_DEPLOY ordering and role grants in **auction-infra** when
  shop-api is in the deployment set; re-run migrate if schema drifted.

This is separate from **Auth** cutover (`auth-test-image-cutover.md`).
