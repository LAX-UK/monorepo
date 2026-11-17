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
placeholder DSNs on the reserved `sentry.invalid` host for the apps that have the SDK and are audited. The
placeholders send nothing, nothing is deployed from that build, and the measured bundle is the one
production builds. Without them the Bid numbers are about 16 KB low.

Apps marked `"requireSentry": true` in the config are refused (exit 2) when their main files hold no
inlined DSN, so a build made without one cannot silently under-count. For a local build, either set
the variable (`NEXT_PUBLIC_SENTRY_DSN_WEB`, `NEXT_PUBLIC_SENTRY_DSN_SHOP` or
`NEXT_PUBLIC_SENTRY_DSN_ART` or `NEXT_PUBLIC_SENTRY_DSN_ACCOUNT`, for example to `https://local@sentry.invalid/1`) or pass
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

Not moved: the live session provider and the live lot banner. They share one subscription with
the lot cards and the mobile summary bar. The socket client itself now loads on demand (see "Live
socket loaded on demand"). The toast library still reaches the sale page through the time chip's zone dialog
(`@auction/ui/time`), which every product shares.

## Library trims

The third-party code in the first scripts of public pages was checked against what the pages
actually use. Lenis is not touched.

| Library | Was | Now |
| --- | --- | --- |
| `zod` (12.9 KB) | in the frame of every page: the attribution cookie check (`parseMarketingAttributionSnapshot`), the theme default (`DEFAULT_THEME_PREFERENCE`) and the account switcher's count check | gone from the frame. The snapshot and count checks are written out by hand and give the same answers as the Zod schemas they replace (equivalence tests in `marketing-attribution-parse.test.ts` and `account-needs-you.client.test.ts`). The Zod schemas for API bodies are in `marketing-attribution-schema.ts`, and the theme values in `ui-preference-defaults.ts` |
| `better-auth` client (about 10 KB with `@better-fetch/fetch` and `nanostores`) | on the lot page, for the "send verification email" buttons | fetched when one of those buttons is pressed (`send-verification-email.lazy.ts`). The button shows its busy state as before while the code loads, and a failed fetch reads as a failed send |
| `@date-fns/tz`, `@radix-ui/react-slot`, `better-auth`, `cmdk`, `date-fns`, `embla-carousel-react`, `jose` | listed in `apps/web/package.json` but never imported by the app | removed from the app's dependencies. The workspace packages that use them still declare them, and the lockfile resolves the same versions |

Zod was still on home, the sales list, the sale page and the lot page then (live-bid events, the
lot and sale response schemas and the newsletter form); see the next section.

Measured on the CI build (Sentry on, gzip, start-up set): the frame of a content page went from
362.6 to 349.5 KB, about from 370.5 to 357.4 KB, terms from 367.4 to 354.4 KB and the lot page from
536.6 to 524.7 KB. Home (434.2), the sales list (476.3) and the sale page (539.2) are unchanged: the
frame is smaller, but their own page scripts now carry zod. The lot group's budget is now 578 KB.

## Live socket loaded on demand

`socket.io-client` and `engine.io-client` are a separate chunk, fetched by the first call to
`getSocket()` (`lib/socket.ts`). That call is where the client used to connect, and every live
surface makes it on mount (the lot and sale providers already in render), so a live sale or a lot
open for bidding starts fetching at once, not on interaction. `getSocket()` returns a stand-in
with the part of the Socket.IO API the app uses: `on`, `off`, `emit`, `timeout(ms).emit`,
`connected`, and `io.on` / `io.off` for the manager. The connection itself is opened by
`lib/socket-connection.ts`, with the same URL, transport, ticket auth and options as before.

| Before the client has arrived | Behaviour |
| --- | --- |
| `on`, `off`, `emit`, `io.on`, `io.off` | recorded in one list, in call order, and replayed on the real socket as soon as it is created, before any event can arrive. Socket.IO then holds the emits until it connects, as it always did, so room joins and leaves, listeners and the first `connect` happen in the same order as before. Listeners are kept as their net effect and at most 100 messages wait (oldest dropped first; live surfaces join again on `connect`) |
| `timeout(ms).emit` | as above, but the ack timer starts at the call, as in Socket.IO: if the client is still loading after `ms` the ack hears `operation has timed out` and the message is never sent |
| `connected` | `false`, as it was while the socket was connecting |
| The chunk cannot be fetched | listeners hear what Socket.IO raises for a failed handshake: `error` and `connect_error` for each failure, `reconnect_attempt` before each retry, `reconnect_error` when a retry fails, `reconnect` when the connection finally opens. Retries use Socket.IO's default backoff (1 s doubling to 5 s, ±50%, never under 500 ms) indefinitely, and run at once when the browser comes back online. The health dot stays "connecting" and the notice escalates to "paused" with Refresh, as for an unreachable server |
| A deploy removed the chunk | after 3 failures in a row while online, the chunk is checked with an uncached `HEAD`; on 404 or 410 the page reloads once onto the new build (at most once per tab every 10 minutes, `lib/socket-chunk-recovery.client.ts`) |

After that every call goes straight to the real socket: reconnects, room rejoin on `connect`, the
latency probe and every event are Socket.IO's own, unchanged.

Measured on a production build (Sentry on, gzip, start-up set): home went from 434.2 to 422.3 KB,
the sale page from 539.3 to 527.9 KB, the lot page from 524.7 to 514.0 KB, and the signed-in
account frame by 11.3 KB (`(client)/layout` reaches the user notification socket). Content pages
and the sales list grew by 1.0 KB: their frame holds the same 100 modules as before, but webpack
now splits them into four files instead of three, and each file is compressed on its own. Their
ratchets were re-recorded. Budgets: public 465, sale 581, lot 566, checkout 544, account 626 KB.

## Zod, date-fns and Sentry tracing off public first load

The rest of the library work: no public Bid page loads Zod or date-fns in its first scripts, and
public pages no longer run browser performance tracing. Lenis is unchanged.

| What | Was | Now |
| --- | --- | --- |
| Public form checks (newsletter, search box, press filters, contact, private sales enquiry) | Zod and `@hookform/resolvers` in the page scripts | each form's schema is in a `*.validation.ts` module behind `lazyResolver` (`lib/forms/lazy-resolver.ts`): fetched when a field first takes focus, or on the first check. The form, its messages and its focus handling are unchanged. `useActionForm` takes a `resolver` instead of a schema. If the module cannot be fetched (offline, or a release removed the old chunks), the submit ends instead of hanging: the button resets, the form shows its own failure message (contact and private sales: "We couldn't send your message"; newsletter: its sign-up failure banner; search box and press filters: "Search didn't load") and the next submit fetches the module again (`*.lazy.failure.test.tsx`) |
| `publicFormErrorMap` | imported Zod for `z.ZodIssueCode` | uses the same codes as strings and only a type import |
| Live bid updates (`parseBidUpdateFromRealtimeRaw`) | the Zod union of every realtime event | a hand-written check in `@auction/validators` (`lot-bid-update.ts`), held to the Zod contract by equivalence tests on crafted and random payloads |
| Bid rows (bid writer, bid history refetch) | `parse/index.ts`, which builds every lot, sale and submission schema | `parseBidRow` (`lib/data/http/bid-row.ts`), plain code; `bidSchema` now wraps it. Equivalence tests against the previous schema |
| Lot snapshot after a socket reconnect | the lot schema in the page scripts | the lot schema is fetched alongside the request; a failed fetch reads as a failed refetch, as any other failure did |
| Buyer's premium | `buyer-premium.ts` built the tier schema at load | the schema is in `buyer-premium-schema.ts`; the policies have no Zod |
| `@auction/datetime` day helpers | `day.ts` pulled date-fns and `@date-fns/tz` into every page for `addCalendarDays` | `startOfDay`, `endOfDay` and `addCalendarDays` are in `day-zoned.ts`; the formatters import `day.ts` only |
| Zone offsets | `tzOffset` from `@date-fns/tz` | `zoneOffsetMinutes` (`zone-offset.ts`), a port of the same function checked against it for every zone the runtime knows. `public-formatters-no-date-fns.test.ts` keeps date-fns out of the formatters' imports |
| Browser tracing | on every page | from the first account (`(client)`), sign-in (`(task)`) or staff (`admin`) page of the session (`lib/observability/sentry-client-options.ts`). A session that loads one of those pages starts with tracing; a session that loads a public page has no tracing integration and no sample rates, so it sends no transactions, until it client-navigates into one of those areas: `onRouterTransitionStart` then adds the same sample rates and the tracing integration (`client.addIntegration`, already in the bundle, no page-load span) before the navigation span starts, so that navigation is traced too. Error reporting is the same on every page. The sampler decides a navigation span by the page it opens and drops public pages' spans |
| Sentry debug code | stripped through the deprecated `disableLogger` | `webpack.treeshake.removeDebugLogging` (same `__SENTRY_DEBUG__ = false`) |

The Sentry bytes do not change. The debug code was already stripped, and the tracing code stays in
the shared bundle: `@sentry/nextjs` imports its tracing integration statically, and
`removeTracing` would take tracing away from the account and staff areas too.

Measured on a production build of this change merged with the live socket split above (Sentry on,
gzip, start-up set), `main` then this change: sale page 528.7 to 508.6 KB, lot page 514.8 to 495.0,
contact 394.1 to 376.6, artist profile 480.8 to 463.3, search 492.6 to 476.6, private sales 413.0
to 396.8, sales list 476.4 to 461.7, press 410.6 to 395.8, home 423.1 to 409.8. Pages that did not
carry Zod moved by -2.8 to +0.8 KB, checkout by +0.7 to +0.8 KB and account pages by up to +4.3 KB:
webpack regrouped shared chunks once those modules stopped being shared with public pages, and a few
(kit buttons, `client-routes`, `sale.schema`) now sit in two start-up files. The ratchets were
re-recorded from that build (`--write-baseline`), and each group's budget is the lower of the one
`--suggest` gives and the one it had: public 451, listing 525, sale 560, lot 545 KB; checkout (544)
and account (626) keep their budgets.

## Account and checkout back under their earlier size

Two causes of the account and checkout growth above, both modules shipped twice:

| What | Was | Now |
| --- | --- | --- |
| Notification parsers in the account frame (`use-user-notifications`, `use-unread-notifications`, `use-notifications-inbox`) | imported from `lib/data/http/parse`, whose index builds the lot and sale schemas; the `(client)` layout kept its own copy of those schemas while the page loaded them again | imported from `parse/notifications.parse.ts`, so the account frame no longer carries the lot and sale schemas |
| `client-routes.ts`, `lib/marketing/chrome.ts`, `@auction/branding` `marketing-chrome` | under webpack's 20 KB split size, so copied into the root layout and into several shared chunks the same page loads (an account page had three copies of `client-routes`) | one `shell-routes` chunk (`next.config.ts`, a `cacheGroups` entry for these three files only). The root layout imports all three, so every page already loaded them |

Measured on production builds (Sentry on, gzip, start-up set), before the Zod change, then `main`,
then this change: settings 501.0, 506.2, 497.7 KB; notifications 503.4, 508.5, 501.1; checkout
456.2, 457.8, 451.5; bids 532.4, 530.3, 523.1; purchases 507.9, 509.4, 502.0. Public pages also
lose 1.4 to 3.3 KB (home 409.8 to 407.5, sale page 508.6 to 505.3). Sign-in and onboarding pages
(`(task)`), which had no duplicate copies, gain about 0.5 KB for the extra file.

The buyer's premium change (#1343) landed on `main` meanwhile: on the merged tree the sale page is
507.4 KB (+2.1, still under `main`'s 508.7 ratchet), the lot page 486.7 and the sales list 455.0,
settings 498.9, notifications 502.0 and checkout 450.0. The ratchets were re-recorded from a build
of the merged tree and each budget is the lower of `--suggest` and its previous value: public 448,
listing 523, sale 556, lot 536, checkout 537, account 620 KB.

Later (CO-7, cached public sale and lot pages, and the overlay motion) the same 20 KB threshold
split shared modules again. More entries keep them in one copy:

| What | Was | Now |
| --- | --- | --- |
| Session, consent, theme and bottom-bar modules the root and group layouts share (`auth-session-provider`, consent context, theme cookie, `marketing-bottom-tab-bar`, the button) | one shared chunk, just over 20 KB only while the lot page also used them all; when it stopped, they were copied into the root layout and the group layouts' chunk (about 6 KB on every public page) | in the `shell-routes` chunk (`SHELL_SESSION_MODULES`) |
| The route error page (`app-route-error` and what it renders) | one chunk shared by the error boundaries only while the button sat in it | in the `shell-routes` chunk (`ROUTE_ERROR_MODULES`) |
| The kit primitives the root layout renders (LAX button and variants, both tooltips, density context, LAX class strings, `cn`) | one chunk shared with the account frame and error boundaries, over 20 KB only while its other modules stayed the same size; the overlay motion (#1476) removed dead animation classes from the kit, the chunks regrouped and these were copied into the account frame and each error boundary (3 to 9 KB on account pages) | in the `shell-routes` chunk (`KIT_PRIMITIVE_MODULES`) |
| A route handler that imports client components (`GET /api/lots/:id/me` reached the artwork accordion and the `@/lib/buyer-account` barrel) | a client entry of its own, which reshapes the shared chunks of every page | the `/me` route handlers import no `"use client"` module: the accordion builder is passed into the lot view model, `pendingRestore` lives in `lib/legal-entity/pending-restore.server.ts`, the container imports the readers directly |

The forced entries share the one `shell-routes` chunk: each extra start-up file counts against
webpack's initial request limit, and a separate chunk per entry left the sales list over its
ratchet.

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

## Base vs head

Every pull request's `build` job also prints a **Route JS: base vs head** table in its job summary:
the exact gzip start-up JavaScript of each page route in the PR against the same route at its base,
both built in that job, in the same checkout path, with the same settings. It is how a reviewer
tells real growth from noise.

### Size builds are deterministic

Before, two builds of one commit could differ by a few tenths of a KB on a route, so a PR's table
compared with main's showed +0.1 to +0.3 KB that nobody had written. The causes, and how CI's size
builds pin them (the `build` job's `env`):

| Source | Why it moved sizes | Pinned by |
| --- | --- | --- |
| Server action ids | Next salts every server action id inlined in client chunks with the server actions encryption key, which it generates at random for each build when none is set. Different random ids compress differently, and a changed chunk changes its hash, which changes the webpack runtime that lists it. | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, a fixed all-zero placeholder (not a key anyone uses) |
| Sentry release | The Sentry plugin inlines the release name in the client bundle and defaults it to the commit SHA (`GITHUB_SHA`, else `git rev-parse HEAD`), so a PR and its base always differ. | `ROUTE_JS_SIZE_BUILD=1`, which each app's `next.config.ts` turns into the fixed release name `route-js-size-build` |
| Webpack tie order | Two webpack orders follow which asynchronous work finished first, not the code. Next adds the app router's client entries while it walks the server build, and deterministic module ids settle a hash collision by the order those entries were added: one Bid module was `62629` in one build and `29772` in the next, which moved `/(client)/purchases/pay` and Bid home by 5 to 10 bytes. The split-chunks step keeps the first of two equally good candidates in module build order, so a page could get either of two chunks with the same modules (six such pairs in Bid; `/(marketing)/sell/*` loads one). | `ROUTE_JS_SIZE_BUILD=1`, which each app's `next.config.ts` turns into `DeterministicSizeBuildPlugin` (`packages/observability/src/next-size-build.ts`, client builds only): it sorts the entries by name and the modules by identifier before webpack uses them, so every tie is settled the same way |
| Sentry debug ids | The Sentry plugin puts a debug id in every chunk and derives it from webpack's content hash, which hashes how the modules were built (sources, source maps, module graph data), not the code the chunk ends up with. That hash can change while the code does not: lax.art and Account chunks of about 410 KB came out identical except for the id. A new id changes how terser names variables (it counts characters across the whole chunk), the chunk's file name and the webpack runtime that lists it, so every route of an app moved by 1 or 2 bytes. | The same plugin replaces each debug id, right after the Sentry plugin adds it and before minifying, with one derived from the chunk's own code. It keeps the id's length and format, so sizes stay what visitors download; size builds have no Sentry token, so nothing is uploaded with it |

Both variables are in the `build` task's `env` in `turbo.json`, so they reach `next build` and size
builds never share a turbo cache entry with any other build. Deploy builds set neither: their
release stays the commit SHA, Next generates their key as before, and the plugin is not added
(their debug ids stay Sentry's own).

The key is safe to pin because of where it is used. It only encrypts the closed-over variables of
server actions and salts their ids, and only in the build that has it. These builds are never
deployed or run: CI measures their `.next` output and throws it away, and a deploy image is built
from scratch in Docker without the variable, so Next generates its own key there. The all-zero
value is public on purpose (it is in this repository); it protects nothing and is used nowhere
else. Any other workflow that started deploying a size build would have to set its own key.

A third source is not an environment setting: the **checkout path**. Next 15 hashes each server
action id from the action's key and its module's absolute path, the Sentry debug id
(`_sentryDebugIds`) is derived from the chunk content, and the chunk hashes and the webpack runtime
that lists them follow. The same commit built at two different paths (for example a git worktree
next to the CI checkout) differs by 19 to 92 bytes on routes that use server actions. So CI builds
the head and the base **in the same directory**, one after the other, and a self-check proves it
(see below). Turbo's task hashes do not depend on the path, and CI's size builds all run in the
same workspace path, so an app replayed from the remote cache is byte-identical to a fresh build.

Checked on 2026-11-16 with pairs of clean builds of one commit in the same directory:

- Without the pins, and with the same environment for both builds (even the same `GITHUB_SHA`),
  every app moved: Bid 113 of 114 routes (from -0.30 to +0.16 KB), Shop 11 of
  39, lax.art 43 of 43, Account 19 of 20, Shop Admin 37 of 51.
- With the key and release pinned but without `DeterministicSizeBuildPlugin`, builds still moved
  now and then, in CI and locally: on PR #1494 the CI self-check found every route of Account,
  Bid or Shop shifted by 1 or 2 bytes in four of six runs, and `/(client)/purchases/pay` +10 B
  and Bid home +5 B in another. Two local Bid builds in a row had different client scripts too
  (chunk `38409` and four staff pages; then two staff pages through the identical-chunk tie). With
  the tie order fixed, two concurrent builds of all five apps still differed once in Shop and
  Account (every route +2 B) and once in lax.art (outside the start-up sets): chunks identical
  except for the Sentry debug id, which is why the plugin also derives that from the code.
- With the key, the release and the plugin, **two uncached, concurrent builds of all five apps
  (turbo `--concurrency=2`, 15m35s and 16m23s on 4 vCPU) gave byte-identical client scripts in
  every app**: 0 of 114, 39, 43, 20 and 51 routes changed. CI's self-check holds every later run
  to the same.
- Deriving the debug ids from the code moved routes by -10 to +37 bytes (mean +7) against
  Sentry's own ids, once: the ids are other strings of the same length and compress a little
  differently. Base and head both get it, so the table compares like for like, and the budget
  and ratchet step reads the same builds as before with no rule changed.
- The build id is random per build but only names the directory of `_buildManifest.js`; it is in
  no script, so the report's digest replaces it with a placeholder. Timestamps appear in no client
  script. The `next/font` CSS modules' source differs between builds, but the CSS files they
  produce are byte-identical and they add no JavaScript.
- The same commit built in a git worktree at another path, with the same pins: Account 15 of 20
  routes changed (`/account/profile/page` +92 B, `/account/security/delete/page` +25 B, ...). This
  is why the base is built in the head's own checkout.

### What CI does

1. **Build** builds the affected apps with the size settings, and the budget check runs as before.
2. `scripts/route-js-size-report.mjs` writes the head report: per app, every page route the budget
   check measures (same start-up set, same ignored routes; Shop Admin has no budget and is reported
   only) in exact gzip and raw bytes, plus a digest of all client scripts.
3. The **base** is the main commit GitHub merged the PR onto for the run (the first parent of the
   test merge commit CI checks out), so the table shows the PR's change and nothing from main.
   `scripts/route-js-size-base.mjs plan` picks the apps: those in the head report that exist at the
   base. The measuring scripts are copied out of the checkout, then
   `scripts/route-js-size-build-base.sh` checks the base out **in the same workspace**
   (`git checkout --detach`, then `git clean -ffdx` except the local turbo cache, and a clean
   `pnpm install`), builds those apps with the same settings, writes the base report, and checks the
   head back out with a clean install, even when the build fails. Workspace packages replay from
   the job's turbo cache and apps from the remote cache when CI already built them at that commit.
   The base report is kept in the actions cache for re-runs and later pushes onto the same base;
   its key covers the base commit, the apps, the measuring scripts, `.github/workflows/ci.yml` and
   `turbo.json`, so a PR that changes a size-build setting never reuses an older base report.
   A base from before the pins (no `ROUTE_JS_SIZE_BUILD` in its `turbo.json`; only the runs of
   the PR that added them) gets, for that one build, the pins in its `turbo.json` build env and
   the head's `next.config.ts` files, whose only size-build change is the pin, and is built
   without cache in turbo's strict env mode. Checking the head back out undoes both edits.
   The first version of this table instead built such a base with `--env-mode=loose` and the
   release pinned through `SENTRY_RELEASE`; on this PR that left 2 Bid routes 3 and 7 bytes
   apart from the head. With the pins applied as above, an uncached local build of that base and
   of the head gave 0 of 114 Bid routes changed and byte-identical client scripts.
4. `scripts/route-js-size-compare.mjs` prints the table.
5. **Self-check.** When a PR changes what a size build depends on (`.github/workflows/ci.yml`,
   `turbo.json`, the root `package.json`, `pnpm-lock.yaml`, `.nvmrc`, a `scripts/route-js-*` file
   or an app's `next.config`), the job builds the head a second time through the same base route
   (`route-js-size-build-base.sh --force`, so nothing replays from a cache) and compares it with the
   first head build using `--require-unchanged`. Every app must read `0 of N routes changed`
   with **client scripts byte-identical**; any changed, new or removed route, and any client
   script that differs, fails the job. It fails closed: a failed self-check means the size build
   is not deterministic, so that run's base-vs-head table is not trusted and the job stays red
   until the cause is fixed. Re-running until it passes is not a fix. A pass shows the base route
   measures like for like.

### CI cost

Measured on PR #1494 (`ubuntu-latest`, 4 vCPU), where every build was uncached because the PR
changes the size-build settings and the base predates them:

| Step | Measured | Before this table |
| --- | --- | --- |
| Build (the head, all five apps, uncached) | 13m14s to 16m39s | 10m51s |
| Build the base for route JavaScript (uncached) | 13m20s to 16m08s | none |
| Route JavaScript self-check (uncached) | 13m28s to 16m29s | none |
| The whole `build` job | 40m39s to 49m54s | about 11 to 12 minutes |

(Three runs, 43869364824, 43877647575 and 43900302509. The head build is slower than before only
because this PR changes the size-build settings, so nothing replayed.)

The steady state, once `main` has the pins, depends on the remote cache:

- **Every PR that builds an app** builds its base. CI's size builds all run in the same workspace
  path with the same settings, and turbo's task hash depends on content and the listed env, not
  on the path or the commit SHA. The merge queue writes the remote cache (`remote:rw`), so a base
  app that was built when its commit went through the queue replays: the base step then costs
  two `pnpm install --prefer-offline` runs (about 5 to 15 seconds each in CI), the replay of the
  apps' `.next` output, and the report. When an app misses (main moved by a commit the queue built
  without that app, or an evicted entry), it is built: up to one uncached build of the affected
  apps, 13 to 16 minutes for all five. The base report is then kept in the actions cache, so
  re-runs and later pushes onto the same base skip the step.
- **The self-check** runs only on PRs that change a size-build input (step 5) and always costs one
  uncached build of every app the head built: 13 to 16.5 minutes for all five.
- So a typical PR pays a few minutes for the base on a hit and up to about 16 minutes on a miss; a
  PR that changes size-build inputs pays about 30 minutes more than before. The hit rate after
  merge is not measured yet: no PR has had a base with the pins. Measure it on the first PRs
  after merge from the "Build the base for route JavaScript" step time and turbo's `Cached:` line.

### Reading the table

- One block per app built on both sides: `N of M routes changed`, and whether the client scripts
  are byte-identical. A route that did not change has no row. Because both sides are built at the
  same path with the same pins, and the self-check holds two builds of one commit to
  byte-identical client scripts, **any number in the table is a real change made by the PR**, even
  one byte, and even when every route of an app moves by the same amount (a change to a chunk
  every route loads does exactly that). There is no tolerance and no noise to allow for. If a
  table ever shows a change the PR cannot have made, the build has stopped being deterministic:
  that is a bug in the size build, the table is not trusted, and the PR is not passed on it.
- Columns are base and head KB (1024 bytes, two decimals), the delta in KB, and the delta in bytes.
  Rows are sorted by growth, largest first. `new` and `removed` mark routes on one side only.
- "client scripts differ" with no changed rows means code changed outside the start-up sets (for
  example a chunk loaded on demand, or a staff admin page, which is not measured).
- Apps built on one side only are listed and not compared.

### What fails

- **Motion and performance PRs** fail the step when any existing route grows by even one byte, and
  when they add a page route: they promise no route JavaScript growth on any route
  (`docs/design/motion.md`, MO14), and a new route is start-up JavaScript visitors did not download
  before. A PR counts as motion or performance work when a label or a word in its title matches
  `motion`, `perf` or `performance`, **or** when it changes a motion source file: code or styles
  under `apps/` or `packages/` with `motion` in a directory or file name (for example
  `packages/ui/src/lax/motion.css` or `packages/marketing-ui/src/motion/`), tests and docs
  excluded. The path rule keeps the check on if a motion PR is renamed or loses its label. The step
  reads the PR's current title and labels, so after adding a label, re-run the `build` job. If the
  base cannot be built, such a PR fails too, since the proof is missing; re-run the job once the
  base builds. Growth is never waved through as variation: every grown byte fails such a PR.
- **Every other PR**: the table only reports (a notice per grown or new route). Pass or fail is
  decided by the budget and ratchet rules above, unchanged. New routes are judged by their group's
  budget as before.
- **The self-check** (step 5 above) fails the job when the head built twice differs on any route
  or in any client script. Its table and the run's base-vs-head table are then not trusted.

The table adds no allowance anywhere and changes no budget, ratchet, baseline or tolerance. The
ratchet's `toleranceKb` still applies to the ratchet check as before.

To reproduce CI locally, do what the job does: build the head, then build the base (or the head
again, for the self-check) through `route-js-size-build-base.sh` in the **same checkout**. The
script checks other commits out with `--force` and runs `git clean -ffdx`, so commit or stash your
work first, and run it from a copy of the scripts outside the checkout:

```sh
export ROUTE_JS_SIZE_BUILD=1 NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
  NEXT_PUBLIC_SENTRY_DSN_WEB=https://budget@sentry.invalid/1 NODE_OPTIONS=--max-old-space-size=6144
tools=$(mktemp -d) && cp scripts/route-js-*.mjs scripts/route-js-*.sh scripts/route-js-budgets.json "$tools"
pnpm turbo run build --filter=@auction/web
node scripts/route-js-size-report.mjs --app apps/web --out /tmp/head.json
# The base: origin/main, or HEAD (with --force) for the self-check.
bash "$tools/route-js-size-build-base.sh" --sha origin/main --apps apps/web \
  --filters --filter=@auction/web --tools "$tools" --out /tmp/base.json
node scripts/route-js-size-compare.mjs --base /tmp/base.json --head /tmp/head.json
```

With `--sha "$(git rev-parse HEAD)" --force` and `--require-unchanged` on the compare, this is the
CI self-check and must print `0 of N routes changed`. Building the two sides in different
directories (a worktree, a second clone) does not reproduce CI: the path changes server action ids.

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

Live-sale socket code (`socket.io-client`, `engine.io-client`) sat further down on the sale and lot
pages; step 7 moved it to a chunk fetched on first use. Lenis is part of the frame and stays exactly as it is.

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
