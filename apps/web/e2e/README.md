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
```

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
# CI-parity PR gate (format, session mint, @smoke|@visual|@roles)
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
