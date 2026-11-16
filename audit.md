Result: GAPS FOUND

# GAP-28 (P1): can TEST seed staff and demo accounts reach real data or live keys?

Read-only audit of `main` at `ac9058a7` (2026-11-16). Only repo code and workflow wiring were read. The
real environment values for test and prod are kept in the private infra repo (`.infra-config`, checked
out by `.github/actions/checkout-infra`) and in GitHub environment secrets. Those were not read, so any
finding marked **infra/owner** needs someone with that access to confirm it.

## Summary

- **Main gap.** Test is seeded by the full dev seed. That seed creates Bid staff logins, including an
  administrator. Every one of them uses one password, and that password is a constant in this public
  repo. The same seed also switches off the staff two-factor requirement. Data on test is safe only
  if test shares no data, keys, buckets or sign-in with prod, and parts of that can't be proven from
  the repo (findings 4–9).
- **Seed guards are uneven.** The demo seeds check that the database is marked as a demo target
  (migration 0398). The dev seed, the check-accounts seed, the onboarding test-user script and the
  Shop acceptance seeds don't check that mark. They rely on address or `NODE_ENV` checks, and some of
  those can be bypassed.
- **What is in good shape:**
  - The API refuses a live Stripe key when `APP_ENV=test`.
  - Zoho Books writes go through a write gate tied to each org's environment.
  - No migration inserts users or credentials.
  - Identity acceptance users get their password from a secret.
  - Demo-seed events are skipped by the notification fan-out.

## Findings

1. **Test staff accounts use a known password, and the test stack seeds them automatically.** P1
   - Where:
     - `packages/db/src/seed/dev/legacy-demo-seed.ts:27`, `:34`: one shared password constant.
     - `:680-830`: about 11 staff users, including `staffRole: "administrator"` at `:688` and
       `finance` at `:702`.
     - `.github/workflows/terraform-test-up.yml:454-455` runs `scripts/ci/run-staging-seed-if-empty.mjs`.
     - That script (`:18-30`) calls `pnpm db:seed`, which is `db:seed:dev`, on any test database
       with no users.
   - Risk: `test*.lax.bid` is publicly reachable. Anyone who reads this repo can get the staff
     administrator credentials for test. On test that means full staff tools, plus whatever keys,
     buckets and integrations test is wired to (findings 4–9).
   - Fix: don't run the password-based dev seed on deployed test. Use one of these instead:
     - The demo seeds (already guarded by the mark), with staff accounts provisioned the way
       `scripts/ci/provision-identity-acceptance-users.mjs` does it, with the password taken from a
       secret.
     - Make the seed's password come from a required secret whenever the target is remote.
     After either change, rotate or reset the passwords of the existing seeded staff accounts on
     test. Removing the constant from code doesn't change accounts that already exist.
   - Needs infra/owner: yes, to reset the existing test accounts and add the secret. The code change
     doesn't.

2. **The dev seed switches off staff two-factor on the target database.** P1
   - Where: `packages/db/src/seed/dev/dev-two-factor-policy.ts:12-23` sets
     `identity_mfa_policy(scope='staff')` to `required=false`. `dev-runner.ts:6-8` calls it on every
     dev-seed run, including the test run from finding 1. This is also recorded in
     `docs/architecture/02-decisions.md:652`.
   - Risk: on test, a password alone gets into the staff tools, so finding 1 is fully exploitable.
     If this ever ran against prod, it would silently remove the staff two-factor policy.
   - Fix: only turn 2FA off when the target is a local or hermetic database, for example localhost
     or a database with `demo_seed_target.environment='local'`. Otherwise leave the 0205 policy
     alone. Then set `required=true` again on test.
   - Needs infra/owner: owner action to set the test policy again. The code change doesn't need it.

3. **The dev seed's production guard rests on `NODE_ENV` and an "empty database" check, not on the
   0398 mark.** P1
   - Where:
     - `packages/db/src/seed/runners/dev-runner.ts:6-8` refuses only when `NODE_ENV=production`.
     - `packages/db/src/seed/runners/dev-seed-guard.ts:24` skips every check when
       `SEED_ALLOW_DESTRUCTIVE=1`.
     - `:27-36` allows a remote or production target as long as its `user` table is empty.
     - `scripts/ci/run-staging-seed-if-empty.mjs` uses the same "no users" test.
   - Risk: if a production database with no rows in that table (new, restored or migrated) is ever
     the target, the seed creates the known-password staff administrator. It also turns off staff
     2FA (finding 2) and wipes tables (`clearAll`). Nothing in the seed itself ties it to test.
   - Fix:
     - Call `assertDemoSeedDatabase` (`packages/db/src/seed/shared/demo-seed-target.ts:80`) at the
       start of `runDevSeed`, before `clearAll`.
     - Remove the `SEED_ALLOW_DESTRUCTIVE` bypass for remote hosts, or make it also require the mark.
     - Make the cli refuse when `APP_ENV` is `production` or `prod`.
   - Needs infra/owner: no. Test is already marked per `docs/runbooks/demo-seed.md`. Check the mark
     exists before the next `terraform-test-up` run.

4. **Other seeds that create accounts use weaker guards than the demo seeds.** P2
   - Where:
     - `packages/db/src/seed/runners/check-accounts-cli.ts:15-19` relies on
       `assertDemoTopUpTarget` (`demo-topup-cli.ts:13-28`). That check only looks for "prod" in
       `NODE_ENV`/`APP_ENV` and in the hostname, and doesn't check the mark. It creates a Bid
       administrator (`packages/db/src/seed/check/check-accounts.ts:45-48`) with the shared demo
       password (`packages/db/src/seed/demo/demo-topup-ids.ts:8`). It runs on test from
       `.github/workflows/worker-task-test.yml:76-80`.
     - `scripts/create-onboarding-test-user.mjs:7-13` uses a constant password and has no
       environment guard at all.
     - `apps/shop-api/src/scripts/seed-acceptance-staff-operations.ts:7` and
       `seed-acceptance-portal.ts:9` refuse production only through `NODE_ENV`, and that check can
       be bypassed with `--force`. The staff-operations seed grants `shop_admin`
       (`acceptance-staff-operations-seed.ts:153-155`).
   - Risk: a misdirected run against a prod address that doesn't contain "prod" (an IP address, a
     pooler or a renamed cluster) would add a known-password administrator or a Shop admin grant in
     production.
   - Fix:
     - Make every seed that creates users or staff grants call `assertDemoSeedDatabase`.
     - Remove `--force`.
     - Add the guard to `create-onboarding-test-user.mjs`, or delete the script.
     - Give the check accounts a password from a secret.
   - Needs infra/owner: no.

5. **The test worker task writes to a bucket with the same name as production's.** P1 (confirm)
   - Where:
     - `.github/workflows/worker-task-test.yml:104-110` and `:132-138` use `S3_BUCKET: lax-media`,
       the `lax-media.lon1` CDN and the `MEDIA_SPACES_*` keys.
     - `.env.production.example:270-283` gives the same bucket and CDN as production's.
     - The workflow comment calls it "the test media bucket".
   - Risk: test writes demo images (`demo/` prefix) and cover slots into production's media bucket.
     If the `MEDIA_SPACES_*` key in the `test` GitHub environment is the prod key, a test-scoped
     workflow holds write access to live media. Test apps reading that bucket could also serve or
     overwrite prod objects.
   - Fix: give test its own bucket and CDN and its own scoped Spaces key, then point the workflow
     at a test-only variable. If sharing is intended, at minimum limit the test key to a `test/`
     prefix and document it.
   - Needs infra/owner: yes.

6. **Shop API and worker don't refuse live Stripe keys on test.** P2
   - Where:
     - Only `apps/api/src/env.ts:699-713` requires `sk_test_`/`pk_test_` keys when `APP_ENV=test`.
     - `apps/shop-api/src/env.ts:87-108` has no such check. `STRIPE_SHOP_CONNECT_PLATFORM_KEY` can be
       `lax_art` (the live platform) on test, and production checks there key off `NODE_ENV`
       (`:385-414`).
     - `apps/worker/src/env.ts:335-346` accepts a live key or `rk_live_` reads on any `APP_ENV`.
     - `packages/finance-runtime/src/payment-eligibility.gate.ts:69-75` treats a live key as "live
       payments", but nothing stops one being set.
   - Risk: one wrong value in the infra app spec would let test Shop checkout, refunds, payouts or
     worker settlement run against live Stripe. Seeded admins (findings 1 and 4) could then issue
     refunds on real money.
   - Fix: copy the API rule into the Shop API and worker env schemas. When `APP_ENV=test`, require
     `sk_test_`/`pk_test_`/`rk_test_` and `STRIPE_SHOP_CONNECT_PLATFORM_KEY=bid_sandbox`.
   - Needs infra/owner: code only. The owner should still confirm the current test values are test
     keys.

7. **Zoho CRM and artwork sync and ATG aren't tied to the environment.** P2
   - Where:
     - In `apps/worker/src/env.ts:185-216`, `ZOHO_*_MODE` can be `live` on any `APP_ENV`.
     - `ZOHO_CRM_EXPECTED_ORG_TYPE` (`:274-277`) is optional, so test isn't forced to a `sandbox`
       org.
     - ATG (`apps/worker/src/integrations/atg/atg-config.ts:17-27`) has one production base URL
       (`.env.example:345`) and no sandbox switch.
     - Zoho Books is fine: the write gate in
       `packages/accounting-zoho-books/src/adapter/write-gate.ts` ties the mode to the org.
   - Risk: if test holds the live Zoho refresh token or ATG credentials, test staff actions and
     demo data flow into the real CRM, artwork register or ATG listings.
   - Fix: when `APP_ENV=test`, require `ZOHO_CRM_EXPECTED_ORG_TYPE=sandbox` and refuse `live` for
     every Zoho mode unless that sandbox check passes. Refuse `ATG_SYNC_ENABLED=true` on test unless
     an explicit ATG test/sandbox account is configured.
   - Needs infra/owner: code change, plus the owner confirming which Zoho org and ATG account test
     uses.

8. **Postmark and accounting defaults aren't separated by environment.** P3
   - Where:
     - No env schema checks that test's `POSTMARK_SERVER_TOKEN` belongs to a non-production
       Postmark server (`.env.example:318-321`).
     - Migration `packages/db/drizzle/0368_accounting_tables.sql:198-199` sets Bid `xero_mode='live'`
       on every database, test included. Only env credentials and `XERO_PROJECTOR_MODE` (default
       `off`, `apps/worker/src/env.ts:293`) keep test from posting.
   - Risk: test sends real email from the production sender reputation and stream, or posts to
     live accounting if credentials are copied across.
   - Fix: on test, use a separate Postmark server and token (or a sandbox stream). Have the worker
     refuse `XERO_PROJECTOR_MODE` other than `off` on `APP_ENV=test` unless a test tenant is named.
   - Needs infra/owner: yes, for the Postmark server and token.

9. **Sign-in cookies and the demo-seed mark aren't fully separated between test and prod.** P2 (confirm)
   - Where:
     - Test hosts are `test*.lax.bid` (`terraform-test-up.yml`). Production uses
       `NEXT_PUBLIC_COOKIE_DOMAIN=.lax.bid` (`.env.production.example:39`), and auth cookies support
       a parent `Domain` (`packages/auth/src/server.ts:15-20`).
     - `demoSeedRefusal` (`packages/db/src/seed/shared/demo-seed-target.ts:62-72`) relies on the
       database name being different. A managed cluster often uses the same name (for example
       `defaultdb`) in both environments, so a prod restore of test, or the reverse, wouldn't be
       caught by name.
   - Risk:
     - Prod cookies scoped to `.lax.bid` are sent to test hosts, so test code could receive real
       users' cookies.
     - If test and prod also share an OIDC issuer, JWKS or session database, a test session could
       be accepted in prod. The repo keeps JWKS separate per environment
       (`scripts/jwks-restore.ts:31-33`), but issuer and DB separation live in infra.
   - Fix:
     - Confirm test and prod have separate DB clusters, roles, issuer URLs and JWKS.
     - Scope test cookies to their exact host, or move test to a separate registrable domain.
     - Make prod cookies host-only or `.lax.bid` only where needed.
     - Add an environment id or cluster id to the 0398 mark, and check it as well as the database
       name.
   - Needs infra/owner: yes.

## Checked and fine

- Migrations don't insert users, credential accounts or staff roles. `0241` and `0248` only copy
  existing rows. So no seed account can reach production through a migration.
- `db:seed --env=prod` throws (`packages/db/src/seed/runners/cli.ts:42-46`).
- Demo seeds (`db:seed:demo-full`, Shop `seed:demo-full`, staff queue seeders) require the 0398 mark.
  Production never gets one (`docs/runbooks/demo-seed.md`, `0398_demo_seed_target.sql`).
- Identity acceptance users take their password from `IDENTITY_ACCEPTANCE_PASSWORD`, a secret
  (`scripts/ci/provision-identity-acceptance-users.mjs:99-107`).
- Seed-written events carry producer `demo-seed`, and notification fan-out skips them.
- Test workflows load database addresses from the `ephemeral/test` Terraform outputs under the `test`
  GitHub environment, not from prod.

## Suggested order

Do 1 and 2 first: remove the constant staff password from test and turn staff 2FA back on. Then
do 3, which puts the mark check on the dev seed. Then 5, 6 and 7, which need owner confirmation of
the test bucket and keys. Then 4, 9 and 8.
