# Deploy checklist

The procedure for shipping a change to production. Follow it top to bottom; do not skip steps for "small" changes.

> **Status note.** Several steps below assume CI/IaC automation that is **(planned)**. Where that's the case, the manual fallback is called out inline. Once Terraform and the `main` → test → `release` → prod cadence land, the manual steps fold back into the automation.

## Before you open the PR

- [ ] Tests pass locally: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- [ ] If you added a new database column or table, you also added it to [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) under the appropriate constant.
- [ ] If you added a new domain event type, you also added it to the catalog in [../architecture/04-domain-events.md](../architecture/04-domain-events.md).
- [ ] If you added a new external integration, you also added a doc in [../integrations/](../integrations/) and an entry in [../README.md](../README.md).
- [ ] You've referenced any relevant D-numbers in the PR description.

## In the PR

- [ ] CI is green.
- [ ] At least one approving review.
- [ ] If migrations are included, the migration has been reviewed against [../architecture/03-data-model.md](../architecture/03-data-model.md) — adding a `NOT NULL` column without a default is a multi-step process, not a one-shot migration.
- [ ] If you touched anything in [../architecture/](../architecture/), the inline status block is still accurate.

## Before merging to test

- [ ] No outstanding review threads.
- [ ] CI green on the latest commit.
- [ ] If your change requires a feature flag (better-auth provider creds, `LEGACY_WS_COOKIE_RELAY`, etc.), the env var is set in the test environment **before** the merge.

## After test deploy

- [ ] Test deploy completes and `/health/ready` is green on every app component (`apps/api`, `apps/auth`, `apps/ws`, `apps/worker`).
- [ ] Smoke test the path you changed against `test.thealx.bid`.
- [ ] If you touched migrations, confirm the test migration job ran successfully — check its log in the DigitalOcean console.
- [ ] If you touched OIDC or JWKS, fetch `/.well-known/openid-configuration` and `/.well-known/jwks.json` manually and confirm they still validate.
- [ ] Soak the change for at least a few hours before promoting to production unless it's an outright bugfix.

## Promoting to production

The `main` → test → `release` → prod gated cadence is **(planned)**. Today, production deploys are manually triggered:

- [ ] In the DigitalOcean App Platform console, trigger a deploy from the same git ref that's running in test.
- [ ] **Confirm the migration job runs first.** If it doesn't, abort.
- [ ] Watch `/health/ready` for every component during the rolling restart.
- [ ] Smoke test the changed path against `thealx.bid`.

## After production deploy

- [ ] Post in the on-call channel: "Deployed `<short-sha>` to production. Changed: `<one-line summary>`."
- [ ] Watch Sentry for the next 30 minutes.
- [ ] Watch Cloudflare WAF and rate-limit dashboards for unusual patterns.

## If something goes wrong

If the production deploy is bad: **trigger a rollback immediately**, then debug. Do not try to forward-fix in production. The DigitalOcean App Platform console has a one-click rollback to the previous deployment.

If a migration is the cause and you can't roll forward, write a compensating migration and ship it through this same checklist — never edit the failed migration.

If you can't tell whether something is wrong (the symptom is ambiguous), follow [./on-call.md](./on-call.md) for escalation.
