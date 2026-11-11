# Browser test portfolio

Browser tests prove critical cross-stack journeys. Unit and component tests own
field behavior, validation, and presentation details.

The stack must be seeded and available at `http://localhost:3000` (web) and
`http://localhost:3001` (API). Use **Node.js 22** (`nvm use` reads `.nvmrc`;
Playwright hangs on Node 25+ in local runs).

```bash
PLAYWRIGHT_E2E=1
PLAYWRIGHT_BASE_URL=http://localhost:3000
PLAYWRIGHT_STAFF_EMAIL=admin@lax.bid
PLAYWRIGHT_STAFF_PASSWORD=Password123!
PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL=staff-catalogue@lax.bid
PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD=Password123!
PLAYWRIGHT_BUYER_EMAIL=estate-owner@lax.bid
PLAYWRIGHT_BUYER_PASSWORD=Password123!
PLAYWRIGHT_CLIENT_EMAIL=user1@lax.bid
PLAYWRIGHT_CLIENT_PASSWORD=Password123!
PLAYWRIGHT_UNAPPROVED_EMAIL=gallery-finance@lax.bid
PLAYWRIGHT_UNAPPROVED_PASSWORD=Password123!
PLAYWRIGHT_INCOMPLETE_EMAIL=viewer@lax.bid
PLAYWRIGHT_INCOMPLETE_PASSWORD=Password123!
PLAYWRIGHT_ZERO_LOT_EMAIL=apple-test@lax.bid
PLAYWRIGHT_ZERO_LOT_PASSWORD=Password123!
```

Rollout flags are applied to existing demo buyers after seed so the admin
clients directory stays at 17 rows. `estate-owner@lax.bid` stays the
organisation buyer; `admin@lax.bid` stays staff. Visual onboarding baselines
stay opt-in via `PLAYWRIGHT_ONBOARDING_VISUAL=1` until Linux diffs are inspected.

## Setup

1. Seed the database: `DATABASE_URL=... pnpm db:seed`
2. Build and start production web on port 3000:
   ```bash
   pnpm --filter @auction/web build && PORT=3000 pnpm --filter @auction/web start
   ```
3. Ensure API is running on `http://localhost:3001` with `WEB_ORIGINS` including `http://localhost:3000`.
4. Start with a clean test Redis instance. Tests do not bypass auth rate limits.

PR gates mint **independent** Better Auth sessions per role (and a separate
staff session for staff, dashboard-roles, and public identity specs) via
`node scripts/ci/prepare-e2e-auth-states.mjs`. Each file is probed against
`/api/auth/get-session` and `/users/me` before tests run. Never commit
`e2e/.auth/*.json`.

Do not password-login inside ordinary specs. If a stored cookie is invalid,
the helper fails with those endpoint statuses instead of clicking Continue
or submitting the login form (that path burns `signInMax` and hides the
real session fault).

## Test tiers

Specs declare intent with tags in describe titles: `@smoke`, `@journey`, `@a11y`,
`@roles`, `@visual`. Commands select by tag — do not hardcode file lists.

```bash
# CI-parity PR gate (format, session mint, @smoke|@roles)
# Requires the seeded stack on :3000 / :3001 / :3003 and a clean test Redis.
pnpm ci:e2e-pr

# Fast PR browser signal
pnpm --filter @auction/web test:e2e:smoke

# Role contracts
pnpm --filter @auction/web test:e2e:roles

# Broader scheduled/manual functional and accessibility gate
pnpm --filter @auction/web test:e2e:stabilization

# Curated admin visual comparison
pnpm --filter @auction/web test:e2e:visual

# Portfolio guard (baseline budget and orphan check)
pnpm lint:e2e-portfolio
```

## Signing out after a check

Every sign-in a check makes is a device in that account's Account > Security > Where you're
signed in. On the shared test environment, checks that never sign out fill the accounts people
review with "Chrome on macOS" rows. So checks end what they start, through the product's own
sign-out, which also ends the sign-in service's session:

- **Saved sessions** (`e2e/.auth`, and Account's `e2e/.auth`): the `sign-out` project is the
  teardown of every setup project and runs after the run's specs. When the sessions were made by
  a separate prepare step (`prepare-e2e-auth-states.mjs`, which sets
  `PLAYWRIGHT_KEEP_AUTH_STATE=1`), end them after the specs with
  `pnpm --filter @auction/web test:e2e:sign-out`.
- **Specs that sign in themselves**: import `test` from `e2e/helpers/test.ts` (Shop, Art and LAX Admin
  have the same file in their `e2e/helpers` or `e2e/support`). The sign-in helpers
  register the browser and the fixture signs it out when the spec ends. A failed sign-out is
  logged, never a failed spec.
- **Scripts** that sign in (screenshots, one-off checks): call `signOutContext(context, { origin })`
  from `scripts/ci/e2e-sign-out.mjs` before closing the browser.

Signing out is on for local runs and off in CI, whose stack is thrown away and whose issuer
request allowance the run's own sign-ins need. Set `E2E_SIGN_OUT=1` or `0` to decide either way.

Never sign out a context that was started from a saved session: that ends the session the other
specs still use.

### Check accounts

Run checks as the check accounts, not as demo or owner accounts. Add them to a test database with

```bash
DATABASE_URL=... pnpm --filter @auction/db db:seed:check-accounts
```

It is additive, so it does not change what the demo data shows. All share the seeded password.

| Email | Use |
| --- | --- |
| `check-client@lax.bid` | signed-in buyer journeys (Shop, Art, Bid): `SHOP_E2E_BUYER_EMAIL`, `ART_E2E_BUYER_EMAIL`, `PLAYWRIGHT_BUYER_EMAIL` |
| `check-new-person@lax.bid` | empty states in Account: `ACCOUNT_E2E_EMPTY_EMAIL` |
| `check-admin@lax.bid` | Bid staff screens: `PLAYWRIGHT_STAFF_EMAIL` |

Journeys that need seeded works, bids or payments (Account's collector, the organisation roles)
still use the demo accounts they need and sign out when they finish. The CI stack keeps using its
own seeded accounts.

The check "five sign-ins and two step-ups in one browser leave exactly one row"
(`apps/account/e2e/signed-in-devices.spec.ts`) is marked `fixme` until a new sign-in on a browser
replaces that browser's earlier one. Remove the `fixme` when that lands.

## Visual baselines

The admin portfolio uses an explicit case manifest rather than every route
multiplied by every theme and viewport. Baselines cover representative shell,
list, detail, drawer, filter, and wizard layouts.

**After pushing spec changes that alter capture regions or masking**, regenerate
baselines in the pinned Linux/Chromium environment:

1. Push the code change.
2. Run the `Generate visual baseline candidates` workflow
   ([`.github/workflows/visual-baselines.yml`](../../.github/workflows/visual-baselines.yml))
   via `workflow_dispatch`.
3. Download the `admin-visual-baseline-candidates-playwright-1.52.0` artifact.
4. Review every PNG diff manually.
5. Commit the approved files under `e2e/__snapshots__/admin-pages-visual.spec.ts/`.

Local update (must match CI environment for parity):

```bash
PLAYWRIGHT_E2E=1 PLAYWRIGHT_VISUAL=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  pnpm --filter @auction/web test:e2e:admin-visual-update
```

Marketing baseline updates are separate and opt-in:

```bash
UPDATE_MARKETING_VISUALS=1 pnpm ci:visual-baseline
```

Never update snapshots merely to make a failed test green. Confirm the target
route, role, loading state, and visual change first.

## Session probe failures

`apps/web/e2e/.auth/session-probe.json` is written during mint and uploaded by
GitHub as `web-pr-session-diagnostics`. A row with `authenticated: false` means
the cookie never became a valid session — check `get-session` vs `/users/me`,
cookie domain (`localhost`, not `127.0.0.1`), and API/auth logs.

Mint through the browser login journey, then flush `rl:auth*`. Ordinary specs
must not password-login or click Continue. `gotoAdminPath` reports session
statuses if it lands on `/login`. Staff and catalogue specs share one worker
cookie jar; role-matrix specs persist a still-valid jar per describe.
