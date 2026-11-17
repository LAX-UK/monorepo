Verdict: SHIP

# Security review of PR #1514: guard seeds with the demo seed mark, refuse live Stripe keys on test

Reviewed head `0414bba5` (`fix/gap28-seed-and-env-guards`) against the GAP-28 audit (`audit.md` on
`review-notes-gap28-audit`). CI on the head commit is green (all required checks pass;
`art-browser-gates` was skipped by path filter). No secret values are committed: the only key-shaped
strings added are placeholders in env tests. The new secret, **`SEED_ACCOUNT_PASSWORD`**, is named in
the PR body.

The PR closes most of what it claims. One gap in the new guard decides the verdict (finding 1). It
is a small change. Findings 2 and 3 should land in the same PR. The rest can follow.

## Audit findings, one by one

| Audit | Claimed | Result |
| --- | --- | --- |
| 1. Deployed test gets staff accounts with a password from this repo | fixed | **Closed for new accounts.** `terraform-test-up` → `run-staging-seed-if-empty.mjs` → `pnpm db:seed` → `runDevSeed` now runs with `APP_ENV=test` and a remote owner URL. The test URL is not local, so the seed needs the `test` mark and `SEED_ACCOUNT_PASSWORD` (16+ characters, not the local password) before `clearAll` or any insert. `worker-task-test` `check-accounts` and `demo-full` take the same path. `seedE2eRolloutIdentities` writes no passwords. The Shop acceptance seeds write no passwords. Every workflow that still uses the local password targets a hermetic `localhost` Postgres service. Accounts already on test are not changed by this PR. That is listed under owner actions. |
| 2. Staff 2FA switched off | fixed | **Closed** for deployed test. `relaxStaffTwoFactor` runs only when `target.hermetic` is true. See finding 1 for how a tunnelled remote database can still be treated as hermetic. |
| 3. Dev seed not tied to the mark | fixed | **Closed, with finding 1.** `assertSeedTarget` runs before `clearAll`. `APP_ENV=production/prod` is refused. `SEED_ALLOW_DESTRUCTIVE` now applies only after the mark check passes. |
| 4. Other account-creating seeds | fixed | **Closed.** I searched the whole repo for anything that hashes passwords, inserts `user`/`account` rows or grants staff roles. The dev seed, `check-accounts`, `demo-topup`, `demo-full`, Shop `seed:demo-full`, both acceptance seeds and `seed:local-admin-staff` all use `assertSeedTarget`. `--force` is gone. `create-onboarding-test-user.mjs` is deleted. The other hits are out of scope: `staff-grant.ts` is a deliberate operator tool that sets no password, the `provision-*-identity` CI scripts take passwords from secrets, and `seed-worker-role-contract-probes.ts` writes a password-less probe user on the CI database. The CLI wiring has no tests (finding 2). |
| 6. Live Stripe keys on test | fixed | **Closed.** `stripeTestModeKeyIssues` in `@auction/stripe-connect` is used by the API, Shop API (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, plus `STRIPE_SHOP_CONNECT_PLATFORM_KEY=bid_sandbox`) and worker (`STRIPE_SECRET_KEY`, every entry of `STRIPE_BOOKS_READ_KEYS`). It only applies when `APP_ENV` is exactly `test` (finding 5). |
| 7. Zoho / ATG | partial | **Zoho CRM done.** On test, any live or canary CRM write, and live artwork sync or QC reads, require `ZOHO_CRM_EXPECTED_ORG_TYPE=sandbox`, and the startup org check now runs for those reads. **ATG deferred** to the owner, as the body says. Zoho Books was already fine. |
| 5, 8, 9 | not in scope | Listed under "Needs infra/owner". Correct. |

### Proof that the tests catch each change

I reverted each change by hand and ran the PR's tests:

| Change reverted | Result |
| --- | --- |
| 2FA relaxed on every target | `dev-runner.test.ts` fails |
| Local password allowed everywhere | `seed-target-guard.test.ts` (2 tests) and `dev-runner.test.ts` fail |
| Mark check removed | `seed-target-guard.test.ts` (4 tests) fails |
| Auto-mark on any host | `seed-target-guard.test.ts` (3 tests) fails |
| `hermetic` ignores the address | `seed-target-guard.test.ts` fails |
| `mark-demo-target local` allowed anywhere | `mark-demo-target-cli.test.ts` fails |
| Production `APP_ENV` allowed | `seed-target-guard.test.ts` fails |
| Stripe rule disabled | `stripe-key-environment.test.ts` fails; so do the API, Shop API and worker `env.test.ts` when each app's own call is removed |
| `bid_sandbox` check removed | Shop API `env.test.ts` fails |
| Zoho sandbox rule removed, or test-read clause removed | worker `env.test.ts` and `zoho-crm-org-check.test.ts` fail |
| **Guard removed from `check-accounts-cli.ts`** | **all 138 db seed tests still pass** |
| **Guard removed from `demo-topup-cli.ts`** | **all 138 db seed tests still pass** |
| **Guard removed from `acceptance-seed-target.ts`** | **all Shop API seed tests still pass** |

## Findings

1. **A loopback address alone makes a database "local". So a remote database reached through a
   local tunnel or port-forward gets marked `local` and treated as hermetic. This fails open.**
   - Where: `packages/db/src/seed/shared/seed-target-guard.ts:116` auto-marks any unmarked database
     whose URL host is loopback when `APP_ENV` is not test/production. `:126` then sets
     `hermetic: true`, because the address is still loopback.
   - Effect: an operator with `APP_ENV` unset who runs `pnpm db:seed` (or `check-accounts`,
     `demo-full`, `demo-topup`) against a forwarded test or production database gets the database
     marked `local`. Every guard after that passes. That database then gets the repo password,
     staff 2FA turned off and (dev seed) `clearAll` without the empty-database check, since
     `dev-seed-guard.ts:26` also treats it as local. The mark is permanent, so later runs pass
     silently too. This is the path the audit's finding 3 was meant to close: "the database must
     say for itself that it takes demo data".
   - Fix (pick one; the first is smallest):
     - In `assertSeedTarget`, auto-mark only when the database has **no rows in `"user"`** (a fresh
       local database). Production and test always have users. Any other unmarked database is
       refused, and the error names `pnpm --filter @auction/db db:seed:mark-demo-target local`.
       Developers whose existing local database predates the mark run that once.
       `db:seed:docker` already marks explicitly.
     - Or drop auto-marking and mark local databases in the local bootstrap (after `db:migrate` in
       the local scripts and CI), so no seed ever writes the mark.
     - Either way, add a test: an unmarked loopback database **with users** is refused and not
       marked.

2. **The seed CLIs' use of the guard has no tests. Removing the guard from `check-accounts`,
   `demo-topup` or the Shop acceptance seeds leaves every test green.**
   - Where: `packages/db/src/seed/runners/check-accounts-cli.ts:31-34`,
     `demo-topup-cli.ts:40-41`, `demo-full-cli.ts:40-41`,
     `apps/shop-api/src/infrastructure/seed/acceptance-seed-target.ts:14`,
     `apps/shop-api/src/scripts/seed-local-admin-staff.ts:79-87`.
   - Fix: give these CLIs the same injectable shape as `runDevSeedSteps` (guard → password → seed)
     and test that a refused target writes nothing and a non-hermetic target without
     `SEED_ACCOUNT_PASSWORD` writes nothing. For `assertAcceptanceSeedTarget`, a unit test with a
     fake db that has no mark is enough. Optionally add a static check that every `*-cli.ts` and
     `seed-*.ts` script that imports `hashPassword`, `ensurePerson` or `grantShopStaffRole` also
     imports `assertSeedTarget`.

3. **The seed functions still default to the repo password. A future caller that skips the
   guard gets the old behaviour silently.**
   - Where: `packages/db/src/seed/demo/demo-full-seed.ts:54`,
     `packages/db/src/seed/demo/demo-topup-seed.ts:68` and `:109` (`password: string =
     LOCAL_SEED_PASSWORD`).
   - Fix: make `password` a required parameter (as `runLegacyDemoSeed` and `runCheckAccountsSeed`
     already do), and pass `LOCAL_SEED_PASSWORD` explicitly in the integration tests.

4. **Repo text still says seeded accounts use the shared password, including in the production
   env example.**
   - Where: `.env.production.example:11` ("All seeded accounts use password: …"),
     `scripts/local/README.md:48` (points to `SEED_PASSWORD` in `legacy-demo-seed.ts`, which this
     PR deleted), `docs/ui/staff-route-redesign-matrix.md:35,42`.
   - Fix: delete the line from `.env.production.example`. Point the local README to
     `LOCAL_SEED_PASSWORD` in `seed-target-guard.ts` and say it applies to local databases only.
     Do the same in the UI matrix doc.

5. **The Stripe and Zoho test rules depend entirely on `APP_ENV=test` being set exactly. In the
   Shop API, a missing or misspelled value falls back to `NODE_ENV`, and the rule is skipped.**
   - Where: `packages/stripe-connect/src/stripe-key-environment.ts:38` compares to `"test"`
     exactly (case-sensitive). `apps/shop-api/src/env.ts:10-14` (`resolveAppEnv`) maps anything
     else to production or development. The worker and API validate `APP_ENV` with an enum, so
     they are fine.
   - Fix: in the Shop API, reject an `APP_ENV` value that is set but not one of
     `production|test|development` instead of falling back. Add "confirm `APP_ENV=test` is set on
     the test API, Shop API and worker components" to the owner list (finding 7).

6. **The `account-e2e-pr` comment is now misleading. `mark-demo-target test ci` does nothing there,
   because the dev seed has already marked the database `local`.**
   - Where: `.github/workflows/account-e2e-pr.yml:151-152`.
   - Fix: drop the line, or update the comment to say the database is already marked `local` by the
     dev seed. This needs no security change. The current behaviour (hermetic, local password) is
     what that job wants.

7. **The "Needs infra/owner" list is accurate but incomplete.** Add:
   - Revoke existing sessions and refresh tokens of the seeded staff, demo and check accounts on
     test. Resetting a password does not end sessions. Review the test audit log for staff sign-ins
     by seeded accounts since test was first seeded.
   - Confirm `APP_ENV=test` is set on the test API, Shop API and worker (finding 5). Without it the
     new Stripe and Zoho checks never run.
   - Any tool that signs in to deployed test as a check or demo account (screenshot or monitoring
     scripts) now needs `SEED_ACCOUNT_PASSWORD` instead of the old password.
   - The Shop database must carry the mark too. If test's Shop and Bid databases are not the same
     database, mark each one.

8. **Low: a single-label host counts as a "local address"**
   (`seed-target-guard.ts:83`). Combined with a `local` mark, that makes a database hermetic. Today a
   remote database can only be marked `local` by hand in SQL, so this is not exploitable through the
   seeds alone. Once finding 1 is fixed, consider limiting `hermetic` to loopback plus an explicit
   list of Compose service names (`postgres`, `db`).

## Local development

`pnpm db:seed` against a fresh `localhost` database still works in one command: it marks the
database `local`, uses the local password and relaxes staff 2FA. `db:seed:docker` marks explicitly.
After fix 1, a developer with an older local database that already has users runs
`db:seed:mark-demo-target local` once. The error message should say so.

## Conflict with PR #1511

#1511 also edits `apps/shop-api/src/scripts/seed-demo-full.ts` and `docs/runbooks/demo-seed.md`.
A trial merge of #1511 into this branch merges the script cleanly but **conflicts in
`docs/runbooks/demo-seed.md`**. After both land, the merged `seed-demo-full.ts` must keep
`assertSeedTarget(db, "shop demo-full", env)` from this PR and not bring back
`assertDemoSeedDatabase`. #1511's new `seedDemoShopStates` writes no accounts or grants and calls
`assertDemoSeedDatabase` itself, so nothing more is needed there. Whichever PR lands second should
rebase and re-run the Shop seed tests.

## Final recheck

Rechecked head `1ef49b85` (`fix/gap28-seed-and-env-guards`, 3 commits: `0414bba5`, a merge of
`main`, and the fixer commit) on 2026-11-17. **All 8 findings are fixed. Verdict: SHIP.**

**CI:** all 41 check runs on `1ef49b85` completed with `success` (including `ci-result`, `test`,
`static-checks`, `identity-acceptance-preflight`, `browser-gates`, `art-browser-gates` and
`account-browser-gates`, which now run `db:seed:local`). Mergeable state: clean.

**Secrets and PR text:** no key-shaped values in the diff. The only `*_live_` strings are the existing
`CHANGE_ME` placeholders in `.env.production.example`. `SEED_ACCOUNT_PASSWORD` is read only from
`secrets.SEED_ACCOUNT_PASSWORD` (`terraform-test-up.yml:459`, `worker-task-test.yml:80,119`). The PR
body has no AI footer and does not walk through an exploit. No commit has AI trailers.

### Findings

| # | Result | Evidence |
| --- | --- | --- |
| 1. Loopback auto-marks `local` | **Fixed** | `assertSeedTarget` never writes the mark. It calls `assertDemoSeedDatabase` and refuses any unmarked database, whatever the address. `hermetic` = mark `local` **and** a local address. Marking is now a separate step (`mark-demo-target`, run by `db:seed:local` / `db:seed:docker`). It refuses `local` when `APP_ENV` is test/production, when the host is not loopback/`postgres`/`db`, and when an unmarked database already has users (unless `--existing-local-database` is passed; no script or workflow passes it). A database already marked `test` keeps that mark, so a tunnelled test database stays non-hermetic: it needs `SEED_ACCOUNT_PASSWORD` and staff 2FA is left alone. `run-staging-seed-if-empty.mjs` now calls `db:seed:dev`, not the local entry point. |
| 2. CLI guard untested | **Fixed** | Each CLI and Shop script calls an exported guarded function, and every one is covered (table below). |
| 3. Seed functions default to the repo password | **Fixed** | `runDemoFull`, `runDemoTopUp`, `ensurePeople`, `runCheckAccountsSeed` and `runLegacyDemoSeed` all require `password: string` with no default. Only `seedAccountPassword` hands out `LOCAL_SEED_PASSWORD`. An arity test covers it. |
| 4. Docs | **Fixed** | The shared-password line is gone from `.env.production.example` (it now says the seeds refuse production). `scripts/local/README.md`, `docs/ui/staff-route-redesign-matrix.md`, `apps/web/e2e/README.md`, the runbooks and the 2FA decision record point to `LOCAL_SEED_PASSWORD` and say it is for local databases only. |
| 5. Stripe/Zoho depend on exact `APP_ENV=test` | **Fixed, fails closed** | `allowsLiveStripeKeys` is true only for `APP_ENV === "production"`. Unset, misspelled or any other value needs test keys. The Shop API passes the raw `APP_ENV` (not the `NODE_ENV` fallback) and throws on an unknown value. `isProductionZohoStack` is `APP_ENV === "production"`, so unset means sandbox only. The cost: production must set `APP_ENV=production`. That is the first owner item. `docker-compose.prod.yml` already sets it for `api` and `worker` (it has no `shop-api` service). |
| 6. `account-e2e-pr` comment | **Fixed** | The `mark-demo-target test ci` line is gone. The comment now matches `db:seed:local`. |
| 7. Needs infra/owner incomplete | **Fixed** | The PR body now covers everything I asked for: revoke sessions and review the audit log, confirm `APP_ENV=test`, update sign-in tooling, mark each Shop/Bid database. It also adds `APP_ENV=production` before deploy, the `SEED_ACCOUNT_PASSWORD` secret, re-enabling staff 2FA on test, test Stripe/`bid_sandbox`, the Zoho org and ATG, the developer one-off mark, and audit items 5, 8 and 9. |
| 8. Single-label host counts as local | **Fixed** | Only `localhost`, `127.0.0.1`, `::1` and the Compose names `postgres` and `db` count as a local address. |

### Proof that the tests catch each change

I reverted each change in the working tree, ran the package's tests, and restored the file. Before
that, all of these suites passed: db seed shared and runners 64/64, Shop seed guard and env 54/54,
worker env and Zoho org check 34/34, stripe-connect 6/6.

| Change reverted | Result |
| --- | --- |
| `hermetic` ignores the mark (address only) | 2 db tests fail |
| Mark check removed from `assertSeedTarget` | 12 db tests fail |
| Any single-label host counts as local | 3 db tests fail |
| Local password allowed on any target | 7 db tests fail |
| `mark-demo-target`: users check removed | 1 db test fails |
| `mark-demo-target`: `local` allowed at any address | 1 db test fails |
| Guard removed from `check-accounts` CLI | 3 db tests fail |
| Guard removed from `demo-topup` CLI | 4 db tests fail |
| Guard removed from `demo-full` CLI | 4 db tests fail |
| Staff 2FA relaxed on every target | 2 db tests fail |
| Destructive-clear check skipped for every target | 2 db tests fail |
| Guard removed from the Shop acceptance seeds | 4 Shop tests fail |
| Guard removed from Shop `demo-full` | 2 Shop tests fail |
| Guard removed from `seed:local-admin-staff` | 3 Shop tests fail |
| Live Stripe allowed unless `APP_ENV=test` | 1 stripe-connect test fails |
| Shop API falls back on an unknown `APP_ENV` | 1 Shop env test fails |
| `bid_sandbox` requirement removed | 2 Shop env tests fail |
| Zoho production unless `APP_ENV=test` | 1 worker test fails |

The three gaps from the first review (guard removed from `check-accounts`, `demo-topup` and the
acceptance seeds, with everything still green) are now caught.

### Search for account-creating scripts

I searched the whole repo for `hashPassword`, `ensurePerson`, `grantShopStaffRole`, `staffRole`,
inserts into `user`/`account`, and shared password constants. Every seed that writes passwords or
staff grants goes through `assertSeedTarget`/`withSeedTarget`: the dev seed, `check-accounts`,
`demo-topup`, `demo-full`, Shop `seed:demo-full`, `seed:acceptance-portal`,
`seed:acceptance-staff-operations` and `seed:local-admin-staff`.

These are out of scope and unchanged since the first review: `staff-grant.ts` (operator tool, no
password), `seed-worker-role-contract-probes.ts` (password-less CI probe), and the
`provision-*-identity` CI scripts (password from secrets). `seed:acceptance-commerce`,
`seed-catalogue`, `seed-editorial-showcase`, `seed-artist-portraits-from-works` and
`seed-press-hub-demo` write no accounts or grants. The remaining `Password123!` literals are hermetic
CI workflow env, e2e helper defaults and the identity preflight on a throwaway local database.

### Residual notes (not blocking)

- `pnpm db:seed` can still mark an **unmarked, empty** database reached on a loopback address as
  `local`. A tunnel is indistinguishable from a real local database by address, and this was the
  design the first review recommended. Production and test always have users and test is marked
  `test`, so this does not reach either. A possible hardening: in `mark-demo-target`, also require
  `inet_server_addr()` to be null, loopback or a private Docker address.
- `db:seed:docker:prod` (root `package.json:79`) still exists. The guard refuses it, because
  `APP_ENV: production` is set in `docker-compose.prod.yml` and production has no mark, but the
  script could be deleted.
- Conflict with #1511 in `docs/runbooks/demo-seed.md`: the note above still applies to whichever PR
  merges second.
