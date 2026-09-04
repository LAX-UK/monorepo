# Deploy checklist

The procedure for shipping a change to production. Follow it top to bottom; do not skip steps for "small" changes.

> **Status note.** Several steps below assume CI/IaC automation that is **(planned)**. Where that's the case, the manual fallback is called out inline. Once Terraform and the `main` → test → `release` → prod cadence land, the manual steps fold back into the automation.

## Before you open the PR

- [ ] Tests pass locally: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- [ ] If you added a new database column or table, you also added it to [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) under the appropriate constant.
- [ ] If you added a new domain event type, you also added it to the catalog in [../architecture/04-domain-events.md](../architecture/04-domain-events.md).
- [ ] If you added a new external integration, you also added a doc in [../integrations/](../integrations/) and an entry in [../README.md](../README.md).
- [ ] If you changed `NEXT_PUBLIC_*` build values, update `infra/web-build/<env>.env` (and GitHub vars/secrets if needed) — see [infra/web-build/README.md](../../infra/web-build/README.md).
- [ ] You've referenced any relevant D-numbers in the PR description.

## In the PR

- [ ] CI is green.
- [ ] At least one approving review.
- [ ] If migrations are included, the migration has been reviewed against [../architecture/03-data-model.md](../architecture/03-data-model.md) — adding a `NOT NULL` column without a default is a multi-step process, not a one-shot migration.
- [ ] For OAuth/logout/SSF Identity hardening, forward order is `0146` →
      `0147` → `0148` → `0149`; rollback order is `0149` → `0148` → `0147`
      → `0146`.
- [ ] If you touched anything in [../architecture/](../architecture/), the inline status block is still accurate.

## Before merging to test

- [ ] No outstanding review threads.
- [ ] CI green on the latest commit.
- [ ] If your change requires a feature flag (provider credentials,
      `IDENTITY_MERGE_ENABLED`, etc.), the env var is set in the test environment
      **before** the merge.

## After test deploy

- [ ] Test deploy completes and readiness is green on `apps/web`, `apps/api`,
      `apps/auth`, `apps/ws`, `apps/worker`, and `apps/shop-identity`.
- [ ] Smoke test the path you changed against `test.lax.bid`.
- [ ] If you touched migrations, confirm the test migration job ran successfully — check its log in the DigitalOcean console.
- [ ] If you touched OIDC or JWKS, fetch `/.well-known/openid-configuration` and `/.well-known/jwks.json` manually and confirm they still validate.
- [ ] If the host-only cookie cutover is included, communicate and verify the
      expected one-time logout; confirm no auth cookie has a `Domain` attribute.
- [ ] Verify Bid/Shop callbacks, resource audiences/scopes, back-channel logout,
      and receiver replay handling. Keep SSF streams and
      `SSF_DELIVERY_ENABLED` disabled until verification passes.
- [ ] Confirm test is not indexable: `curl -sI https://test.lax.bid/ | grep -i x-robots-tag` returns `noindex`; `curl -s https://test.lax.bid/robots.txt` has no `Sitemap:` line; `curl -s https://test.lax.bid/sitemap.xml` is empty.
- [ ] Confirm prod SEO is unchanged: `curl -s https://lax.bid/robots.txt | grep -i sitemap` returns the sitemap URL; prod responses do not send `X-Robots-Tag: noindex`.
- [ ] Soak the change for at least a few hours before promoting to production unless it's an outright bugfix.

## Promoting to production

Production deploys are triggered by merging `main` → `release` (opens **App
deploy prod**, which builds all eight DOCR images, including migration and
ClamAV images, and runs `doctl apps create-deployment`). For hotfixes, you can
also dispatch **App deploy prod** manually or trigger from the DigitalOcean
console.

- [ ] Merge `main` into `release` (or dispatch the prod deploy workflow).
- [ ] Confirm **build-images** succeeded for all eight matrix components.
- [ ] **Confirm the migration job runs first.** If it doesn't, abort.
- [ ] Confirm `PRODUCTION_MIGRATION_THROUGH` is unset (default through `0159`)
      unless you are deliberately promoting `0160` or `0161` after the
      documented directory soak. A normal production migrate must not apply
      those revokes. After a grant rollback, lower or clear the variable before
      the next Job.
- [ ] Watch `/health/ready` for every component during the rolling restart.
- [ ] Smoke test the changed path against `lax.bid`.
- [ ] Confirm required production Identity/BFF/client secrets are bound under
      the exact schema names documented in
      [06-deployment.md](../architecture/06-deployment.md).

## After production deploy

- [ ] Post in the on-call channel: "Deployed `<short-sha>` to production. Changed: `<one-line summary>`."
- [ ] Watch Sentry for the next 30 minutes.
- [ ] Watch Cloudflare WAF and rate-limit dashboards for unusual patterns.

## If something goes wrong

If the production deploy is bad: **trigger a rollback immediately**, then debug. Do not try to forward-fix in production. The DigitalOcean App Platform console has a one-click rollback to the previous deployment.

If a migration is the cause and you can't roll forward, write a compensating migration and ship it through this same checklist — never edit the failed migration.

If you can't tell whether something is wrong (the symptom is ambiguous), follow [./on-call.md](./on-call.md) for escalation.
