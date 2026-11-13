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

After the public-frame leak fixes (Sentry on, largest route per group, budget = size + 10%):

| Bid group | Largest route | Before | After | Frame after | Budget |
| --- | --- | --- | --- | --- | --- |
| public | home | 554.4 KB | 493.2 KB | 424.6 KB | 543 KB |
| listing | search | 737.9 KB | 554.0 KB | 424.6 KB | 610 KB |
| sale | sale page | 805.2 KB | 637.1 KB | 466.9 KB | 701 KB |
| lot | lot page | 644.1 KB | 590.8 KB | 472.0 KB | 650 KB |
| checkout | purchases/collect | 576.4 KB | 553.6 KB | 517.7 KB | 609 KB |
| account | consignment edit | 650.7 KB | 624.5 KB | 520.0 KB | 687 KB |

What moved: the Node `Buffer` polyfill (attribution and acting-context cookies now use `TextEncoder`
and `btoa`), the staff nav and presenters that the account menu pulled in through
`app-shell-nav`, and the kit barrels. Two causes were behind the barrels. `@auction/ui/lax` and
`@auction/ui/time` were not in `optimizePackageImports`, which lists exact specifiers, so every
import of them shipped the whole barrel. And `export { X } from "@auction/ui"` in a consumer is not
rewritten by that option the way `import { X } from "@auction/ui"` is, so each such re-export file
shipped the entire package; write it as an `import` followed by an `export`.

Code that can run in the browser must not use `Buffer`. Next injects a polyfill for it, and that
polyfill throws `Unknown encoding: base64url`. The acting-context cookie (which carries a staff
"view as client" session id) could therefore not be decoded in the browser before; it is now read
through `decodeUtf8Base64Url`, so the browser keeps the cookie as it is and sends the viewed
account's `X-Legal-Entity-Id` header. That is a declared behaviour change of the Buffer fix.

## Frame parts loaded on demand

The parts of the frame that nobody needs for the first paint are separate chunks, fetched when
they are needed:

| Part | Loaded |
| --- | --- |
| Toast library and its host (`components/ui/toaster.tsx`, `lib/ui/toast-bridge.ts`) | when the first toast is raised; a toast raised earlier is queued and shown once the host is on screen |
| Signed-in account control, phone account switcher, attention prompt, push bootstrap and the account-switch greeting | for a signed-in visitor only (`whenSignedIn`, `signed-in-extras.tsx`) |
| Cookie settings dialog | the first time it is opened |
| Analytics debug panel | only with `?lax_analytics_debug` in the URL |

The server draws the same markup as before, and parts that draw nothing until they have data (the
attention prompt, the phone switcher, the greeting) are loaded without a server render. Smooth
scrolling is untouched.

Sizes after this change (Sentry on, gzip): the frame of a content page went from 425.5 KB to
389.1 KB, home from 494.1 to 460.3 KB, the sales list from 526.8 to 501.2 KB, the sale page from
638.4 to 610.6 KB and the lot page from 592.0 to 569.2 KB.

## Header and footer drawn on the server

The footer and the parts of the header that only show links or the logo are Server Components, so
their code is not in the page's scripts. What still needs the browser is a small island:

| Part | Where it is drawn |
| --- | --- |
| Footer (`SiteFooter`, `MarketingFooter`, social links, logo, link columns) | server |
| Footer Account list | browser island (`FooterAccountList`): it follows the session, which can change without a reload |
| Footer link that marks the current page, cookie settings button, phone section fold | browser islands |
| LAX top bar (`LaxFamilyBar`) and Bid lockup (`BidHeaderLockup`) | server, handed to the header as slots |
| Header bar (scroll tone, menus, search, theme, account) | browser (`SiteHeaderChrome`) |
| Phone menu | on demand: fetched when the page is idle, or at once if opened first |

The header's tone (white over a cover photograph, ink on the page) changes as the page scrolls, so
the server cannot hand it to a part as a prop. The header carries `group/header` and its
`data-header-tone`, and the server-drawn parts take their colours from it with
`group-data-[header-tone=on-dark]/header:` classes (`LaxFamilyBar` has `tone="follow-header"` for
this). A lazy component must not hold the phone menu: one that suspends swaps the whole header for
its Suspense fallback and drops the open state, so the loaded menu is kept in plain state, as the
toast host is.

Sizes (Sentry on, gzip, start-up set): the frame of a content page went from 388.0 KB to 362.3 KB,
home from 458.5 to 432.8 KB, the sales list from 500.1 to 475.0 KB, the sale page from 610.5 to
584.6 KB and the lot page from 564.5 to 535.3 KB. Lenis is untouched.

## Sale page parts loaded on demand

Four parts of the sale page are separate chunks, fetched when they are needed:

| Part | Loaded |
| --- | --- |
| Telephone request form (`sale-telephone-booking-panel.tsx`: react-hook-form, the form controls, the validation schema) | only for a signed-in bidder who can book, when its card is within one screen of the viewport (`sale-telephone-booking-panel.lazy.tsx`) |
| Lot status filter sheet (phone) | once the page has hydrated (`saleroom-catalog-filter-sheet.lazy.tsx`) |
| Catalogue sort select | once the page has hydrated (`saleroom-catalog-sort.lazy.tsx`) |
| Day gallery "View all" sheet | when the control is pointed at or focused, or when it is pressed (`day-gallery-view-all-sheet.lazy.tsx`) |

On the first load, what a visitor sees does not change, with one exception: while the telephone
form is on its way its card shows a placeholder of the form's own height (the three fields, the
note and the button), so nothing below it moves. If the fetch fails or takes more than ten seconds,
the message and "Try again" are laid over that same placeholder box, so the card keeps its height;
the message is announced (`role="alert"`), and focus stays in the card while it retries. The filter
trigger and the sort choice are drawn first as before hydration (the trigger, the current choice as
text) and swapped for the live control when its chunk arrives. The stand-in trigger already shows
the active filter badge, read from the address, and a press on it opens the sheet as soon as the
sheet arrives. If a chunk failed, pointing at, focusing or pressing its control fetches it again.
Signed-out visitors, people who still have to verify, people without a buyer profile and people
who already have a booking never download the form.

`useDeferredModule` remembers modules that have arrived. A part mounted again after a client
navigation (sales list to sale, or Back from a lot) is therefore drawn at once, as before the split,
not stand-in first. While server HTML hydrates, the stand-in is always drawn so the markup matches.
The day gallery sheet uses the same hook instead of `next/dynamic`: if it cannot be fetched, the
press is undone instead of the page's error screen showing, and the next press fetches it again.

Two hooks carry the pattern: `useNearViewport` (true once an element is within a viewport of the
screen, and stays true) and `useDeferredModule` (a dynamic import with idle, loading, ready and
failed states, a timeout, a retry and a cache of arrived modules).

Measured on the CI build (Sentry on, gzip, start-up set): the sale page went from 584.6 to 538.7 KB
(page-only part from 179.4 to 133.1 KB). Routes that do not use these parts each grew by up to about
1.1 KB (home +1.1, sales list +1.1, lot +0.8, about +0.2): webpack regrouped shared chunks (home and
lot each load one more file) and the runtime's chunk map names the new chunks. Their module sets
did not change, and their ratchets were re-recorded. The sale group's budget is now 593 KB.

Not moved: the live session provider, the live lot banner and the socket client. They share one
subscription with the lot cards and the mobile summary bar, and the socket is the last PR of the
plan. The toast library still reaches the sale page through the time chip's zone dialog
(`@auction/ui/time`), which every product shares.

## Library trims

The third-party code in the first scripts of public pages was checked against what the pages
actually use. Lenis is not touched.

| Library | Was | Now |
| --- | --- | --- |
| `zod` (12.9 KB) | in the frame of every page: the attribution cookie check (`parseMarketingAttributionSnapshot`), the theme default (`DEFAULT_THEME_PREFERENCE`) and the account switcher's count check | gone from the frame. The snapshot and count checks are written out by hand and give the same answers as the Zod schemas they replace (equivalence tests in `marketing-attribution-parse.test.ts` and `account-needs-you.client.test.ts`). The Zod schemas for API bodies are in `marketing-attribution-schema.ts`, and the theme values in `ui-preference-defaults.ts` |
| `better-auth` client (about 10 KB with `@better-fetch/fetch` and `nanostores`) | on the lot page, for the "send verification email" buttons | fetched when one of those buttons is pressed (`send-verification-email.lazy.ts`). The button shows its busy state as before while the code loads, and a failed fetch reads as a failed send |
| `@date-fns/tz`, `@radix-ui/react-slot`, `better-auth`, `cmdk`, `date-fns`, `embla-carousel-react`, `jose` | listed in `apps/web/package.json` but never imported by the app | removed from the app's dependencies. The workspace packages that use them still declare them, and the lockfile resolves the same versions |

Zod is still on home, the sales list, the sale page and the lot page. There, live-bid events
(`lot-realtime-events`), the lot and sale response schemas and the newsletter form use it. Those
go with the socket step.

Measured on the CI build (Sentry on, gzip, start-up set): the frame of a content page went from
362.6 to 349.5 KB, about from 370.5 to 357.4 KB, terms from 367.4 to 354.4 KB and the lot page from
536.6 to 524.7 KB. Home (434.2), the sales list (476.3) and the sale page (539.2) are unchanged: the
frame is smaller, but their own page scripts now carry zod. The lot group's budget is now 578 KB.

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

## Per-route ratchet and first-load baseline

The group budgets stop a group's largest page growing; the ratchet in
`scripts/route-js-baseline.json` is stricter and tracks six Bid pages one by one: home, sales list,
sale page, lot page, about and a content page (terms). For each it records the size it was measured
at (gzip transfer, parsed size, frame, page, duplicates), and the **target** it is being brought
down to: 300 KB for home, sales list and content pages, an interim 350 KB for the sale and lot
pages. The check fails the build when a tracked route is more than `toleranceKb` (1 KB, for
compression differences between machines) above its recorded gzip size, in every group whether
enforced or not. It prints a notice when a route is more than the tolerance below its ratchet.

When a page is slimmed, record the lower size so it cannot come back:

```sh
node scripts/check-route-js-budget.mjs --app apps/web --write-baseline
```

This keeps each route's label and target and rewrites only the measured sizes. Raising a ratchet is
the same decision as raising a budget (see below) and is reviewed the same way.

Baseline of 2026-11-12 (production build of `apps/web`, browser Sentry SDK on, KB of 1024 bytes):

| Route | Transfer (gzip) | Parsed | Target | To cut | Frame | Page | Duplicate modules |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 494.1 | 1531.6 | 300 | 194.1 | 425.5 | 68.6 | 110 (33.9) |
| Sales list | 526.8 | 1644.7 | 300 | 226.8 | 425.5 | 101.4 | 102 (38.7) |
| Sale page | 638.4 | 1989.1 | 350 | 288.4 | 467.8 | 170.7 | 207 (70.2) |
| Lot page | 592.0 | 1841.3 | 350 | 242.0 | 472.8 | 119.2 | 170 (58.9) |
| About | 433.4 | 1355.0 | 300 | 133.4 | 425.5 | 8.0 | 64 (23.0) |
| Terms (content page) | 430.3 | 1346.3 | 300 | 130.3 | 425.5 | 4.9 | 62 (22.1) |

The frame is 425 to 473 KB on every page, so the 300 KB target for content pages cannot be met by
page-level work: it needs the shared frame cut by about a third.

### Largest contributors (gzip estimate)

From `ANALYZE=true ANALYZE_MODE=json` on the same build, via `route-bundle-report.mjs`. The right
column says which step of the page-weight plan removes it.

| Contributor | Home | Sales list | Sale page | Lot page | Terms | Plan step |
| --- | --- | --- | --- | --- | --- | --- |
| App source | 81.5 | 87.3 | 145.5 | 150.5 | 62.0 | 5 (sale and lot islands), 4 (server header and footer), 3 (frame parts on demand) |
| `next` runtime and router | 75.4 | 75.4 | 76.4 | 75.2 | 75.2 | none (framework) |
| `react-dom` | 54.1 | 54.1 | 54.1 | 54.1 | 54.1 | none (framework) |
| `@auction/ui` | 32.9 | 51.8 | 62.1 | 48.4 | 28.0 | 2 (barrel imports), 3 |
| `@auction/marketing-ui` | 33.9 | 25.2 | 32.0 | 19.5 | 18.5 | 2 (barrel imports), 4 |
| `@sentry/core` | 27.9 | 27.9 | 27.9 | 27.9 | 27.9 | 6 (error reporting stays; browser tracing and debug code go) |
| `@sentry-internal/browser-utils` | 9.1 | 9.1 | 9.1 | 9.1 | 9.1 | 6 (tracing) |
| `zod` | 12.9 | 14.5 | 14.5 | 12.9 | 12.9 | 6 (library trims) |
| `@tanstack/query-core` | 10.6 | 8.6 | 10.6 | 10.6 | 8.6 | 3 (signed-in extras on demand), 6 |
| `@auction/branding` | 10.1 | 10.0 | 10.6 | 9.7 | 9.7 | 6 |
| `sonner` | 9.1 | 9.1 | 9.1 | 9.1 | 9.1 | 3 (toaster on demand) |
| `react-hook-form` | | 11.1 | 11.1 | | | 5 (sale page islands) |
| `lucide-react` | 7.5 | | 9.7 | 9.4 | | 6 |
| `vaul` | | | 8.5 | | | 5 |

Live-sale socket code (`socket.io-client`, `engine.io-client`) sits further down on the sale and lot
pages and goes in step 7. Lenis is part of the frame and stays exactly as it is.

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
