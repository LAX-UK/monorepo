# Route JavaScript budgets

Every Next app (`apps/web`, `apps/shop`, `apps/art`, `apps/account`) is audited after `next build`.
The check measures what a phone downloads to start a page route, and compares it with a budget per
route group.

## What is counted

For each page route the size is the gzip size of every script in its **start-up set**, each file
compressed on its own, which is what the browser transfers:

- the root main files (webpack runtime, framework, `main-app`), which include the Sentry browser
  SDK;
- the entry of the page itself;
- the entries of every ancestor segment: its `layout`, `template`, `error`, `loading` and
  `not-found`, plus the app's `global-error` and `not-found`.

The ancestors matter. A page renders inside its layouts and boundaries, and their client components
ship with it. The check used to read only the page's own manifest entry, which left all of that out
and reported about 100 to 200 KB less than a phone downloads (the Bid sale page 530 KB against 805 KB
now). The set was checked against the script tags of a rendered page: for `/terms` the browser
loads 473.2 KB (the same HTML lists 38.7 KB of `noModule` polyfills that current phones skip, which
are not counted) and the check reports 474.4 KB.

A module that two start-up scripts both contain is shipped twice, and both copies are counted,
because each file is measured whole. The report also lists those duplicates so they can be removed:
the number of module ids found in more than one start-up file, and an estimate of their weight (each
extra copy's share of its file's gzip size). Code fetched later by a dynamic import is not counted.

Each group's row shows the largest route as total, **frame** (root files and all ancestor entries,
shared with the other routes under the same layouts) and **page** (what only that route adds).

Sizes are KB of 1024 bytes. `next build` prints "First Load JS" in kB of 1000 bytes, from the page
entry alone, so it is not comparable with these numbers.

## Sentry is part of the measurement

The browser SDK only initialises, and the start-up code that comes with `Sentry.init` is only in the
bundle, when a DSN is inlined at build time. CI builds without a real key, so the build job sets
placeholder DSNs on the reserved `sentry.invalid` host for the three apps that have the SDK. The
placeholders send nothing, nothing is deployed from that build, and the measured bundle is the one
production builds. Without them the Bid numbers are about 16 KB low.

Apps marked `"requireSentry": true` in the config are refused (exit 2) when their main files hold no
inlined DSN, so a build made without one cannot silently under-count. For a local build, either set
the variable (`NEXT_PUBLIC_SENTRY_DSN_WEB`, `NEXT_PUBLIC_SENTRY_DSN_SHOP` or
`NEXT_PUBLIC_SENTRY_DSN_ART`, for example to `https://local@sentry.invalid/1`) or pass
`--allow-no-sentry`. The Bid app build with the Sentry plugin needs more than Node's default heap:
use `NODE_OPTIONS=--max-old-space-size=6144`.

Budgets are in one file, `scripts/route-js-budgets.json`, per app and route group. The staff admin
area and dev pages are not audited.

## The budgets are a ratchet, not the goal

The targets for LAX Bid are **300 KB** for content pages, the home page and the sales list, and an
interim **350 KB** for the sale and lot pages. The numbers in the JSON file are not those targets.
Each is the largest route in its group when the measurement was introduced, plus 10%: a ratchet at
today's size that stops the pages getting heavier while they are brought down. When a page is
slimmed, lower its group's budget to the new size plus 10% (`--suggest`), so the gain cannot be
lost again.

The Bid public groups are split so a ratchet stays close to the pages in it: `public` (home and
content pages), `listing` (search, artists, press and the sales list), `sale` (a sale page) and `lot`
(lot and artist profile). Measured with Sentry on, largest route per group, before and after the
change in what is counted:

| Bid group | Largest route | Counted before | Counted now | Frame | Page | Budget |
| --- | --- | --- | --- | --- | --- | --- |
| public | home | n/a | 554.5 KB | 485.2 KB | 69.3 KB | 610 KB |
| listing | search | n/a | 738.0 KB | 591.0 KB | 147.1 KB | 812 KB |
| sale | sale page | 588.6 KB | 805.4 KB | 636.9 KB | 168.4 KB | 886 KB |
| lot | lot page | 530.6 KB | 644.1 KB | 536.6 KB | 107.5 KB | 709 KB |
| checkout | purchases/collect | 301.7 KB | 576.4 KB | 550.1 KB | 26.3 KB | 635 KB |
| account | consignment edit | 395.5 KB | 650.5 KB | 552.2 KB | 98.3 KB | 716 KB |

"Counted before" is the old method on a build without Sentry (`public` was one group then, and its
largest route was the sale page).

## Enforcement

`enforce` is set per group. A route over budget in a group with `"enforce": true` is an error line
and fails the `Route JavaScript budgets` step in the build job. In any other group it is a GitHub
warning annotation and the job passes. The Bid `public`, `listing`, `sale` and `lot` groups are
enforced; the checkout and account groups, and the Shop and lax.art apps, warn until they are
decided. A top-level `"enforce": true` makes every group fail; for one run, pass `--enforce` or set
`BUDGET_ENFORCE=1`. Exit codes: 0 pass or warnings only, 1 over budget in an enforced group, 2 bad
usage, bad config or a build without its Sentry DSN.

## Running it

```sh
NEXT_PUBLIC_SENTRY_DSN_WEB=https://local@sentry.invalid/1 NODE_OPTIONS=--max-old-space-size=6144 \
  pnpm --filter @auction/web build        # any app you want to audit
pnpm check:route-js-budget                # summary, plus the over-budget routes
node scripts/check-route-js-budget.mjs --all --app apps/web   # every route
node scripts/check-route-js-budget.mjs --suggest              # largest route + 10% per group
node scripts/check-route-js-budget.mjs --enforce              # fail on over-budget routes everywhere
```

An app without a build is skipped. CI runs the check in the `build` job straight after the build, so
it reuses that output. The `Web PR browser gates` workflow does not run it: its build has no
placeholder DSNs and would not match what the budgets measure.

## Where the bytes come from

The bundle analyser is already wired into `apps/web`. `ANALYZE=true ANALYZE_MODE=json` on the build
writes `.next/analyze/client.json` (no `ANALYZE_MODE` writes the interactive treemap); it is
read only then, and a normal build never loads it. For one route's start-up files:

```sh
node scripts/route-bundle-report.mjs --route "/(marketing)/sales/[slug]/[id]/page" --top 25
```

prints the top owners (npm package, `@auction/<package>` or app source) with a gzip estimate, the
`@auction/ui` and `@auction/marketing-ui` files shipped, and the Node polyfill modules. Each module's
minified size is scaled by its chunk's gzip ratio, so the owners add up to the chunk's gzip size.

### Findings (Bid app, Sentry on, build of 2026-11-11)

Top owners for the sale page `/(marketing)/sales/[slug]/[id]` (805 KB, 77 files):

| Owner | gzip | Note |
| --- | --- | --- |
| app source | 158.3 KB | 547 modules |
| `@auction/ui` | 101.6 KB | 166 component files, 245 modules |
| next (runtime and client router) | 76.5 KB | |
| `@auction/marketing-ui` | 54.9 KB | 117 files |
| react-dom (compiled into next) | 54.1 KB | |
| `@sentry/core` plus browser, utils and nextjs | 46.9 KB | 27.9 + 9.1 + 7.0 + 2.9 |
| `@tanstack/query-core` | 14.8 KB | |
| `zod` | 14.4 KB | |
| `lucide-react` | 13.5 KB | 176 icon modules |
| `@auction/branding` | 12.0 KB | |

Further down: `react-hook-form` 11.1, `react-day-picker` 10.6, `sonner` 9.1, `date-fns` 8.5, `vaul`
8.5, `@auction/identity-contracts` 8.3, `@auction/types` 7.4, `@auction/datetime` 7.1,
`@auction/domain` 7.0, `buffer` 6.2, `embla-carousel` 6.5, `engine.io-client` and `socket.io-client`
9.3 together, `lenis` 5.3, `cmdk` 4.0.

The lot page (644 KB) and home (555 KB) have the same shape: app source 155 and 93 KB, `@auction/ui`
67 and 48 KB, `@auction/marketing-ui` 19 and 34 KB. The frame (root files plus every ancestor's
entry) is 485 to 637 KB on its own, so it is the first thing to reduce: every public page pays it.
It differs by route because each route brings its own layouts and `loading` and `error`
boundaries: the sale page's frame is 637 KB against 485 KB for a content page.

**Duplicates.** The sale page ships 300 modules twice, an estimated 91 KB; home 136 (42 KB); a plain
content page 79 (27 KB). These are module ids that two start-up chunks both contain.

**Shared kits on public pages.** `@auction/ui` ships 166 files on the sale page, including ones no
public page uses: `calendar` and `react-day-picker`, `relation-picker`, `token-input`,
`wizard-progress`, `file-attachment`, `search-palette` and `change-zone-dialog`. They are exported
from the package roots (`@auction/ui` has 198 exports in `src/index.ts`, `@auction/ui/lax` and
`@auction/ui/time` more) and the app imports the roots: 382 imports of `@auction/ui`, 355 of
`@auction/ui/lax` and 127 of `@auction/marketing-ui` against 65 for the most used narrow subpath
(`components/button`). Walking the client import graph from the root layout, the
marketing layout and the sale page's page, layout and loading boundary reaches 676 client files, 99
of them importing the `@auction/ui` root and 33 the `@auction/marketing-ui` root. The heaviest
importer folders are `components/marketing` (23 files), `components/layout` (12 plus 10 in
`layout/palette`), `components/sections/saleroom` (10), `components/marketing/lot-quick-look` (6)
and `components/ui` (6). The package files are marked side-effect free, so the cost is the
modules the bundler cannot prove unused behind a client-component barrel, not the barrel itself.

**Staff code on public pages.** The shared header reaches `@auction/staff-ui` and `lib/admin/*`:
`components/layout/staff-nav.ts` imports the data-request, consignment-inbox and staff-access
presenters, `components/layout/palette/*` imports `components/admin/admin-status-badge` and the
status-badge variants, `components/layout/account-role-pill.tsx` imports the staff-role presenter,
and `components/ui/toaster.tsx` imports `lib/admin/admin-return-path`.

**Node `Buffer` polyfill.** `buffer`, `base64-js` and `ieee754` (6.2 KB plus the two small
modules) are in chunk `51138` of the sale, lot and home pages. Webpack adds the polyfill for any
module that refers to the free variable `Buffer`. On public pages that is
`packages/validators/src/marketing-attribution.ts` (lines 291 to 302, guarded by
`typeof Buffer !== "undefined"`, which does not stop the polyfill), pulled in by
`components/analytics/marketing-attribution-sync.tsx` in the root layout through
`mergeAttributionSnapshot` from the `@auction/validators` root. `packages/types/src/acting-context-cookie.ts`
also uses `Buffer`, but only ships with admin pages today. Replacing `Buffer` with `btoa`, `atob` and
`TextEncoder` in `marketing-attribution.ts` removes the polyfill from every public page.

## Raising a budget on purpose

A budget goes up only when the extra JavaScript is a decision, not drift.

1. Look for the cause first: `--all` shows which route grew, and `route-bundle-report.mjs` shows
   which packages and kit files carry the weight. A dynamic import for a dialog, editor or chart
   often removes the growth.
2. If the growth stays, run `--suggest` for the new size and edit `budgetKb` for that app and group
   in `scripts/route-js-budgets.json`. Round up to a whole KB and keep the headroom to about 10%.
3. Say why in the pull request description: what was added, why it cannot load later, and the
   before and after sizes. A reviewer approves the budget change like any other code change.

To move a route to another group, change the group's `match` patterns. They are regular expressions
tested against the route path with its `/page` suffix removed, for example
`/(marketing)/lot/[slug]/[id]`; the first matching group wins, and routes that match none join the
app's `fallback` group.
