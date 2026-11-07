# E2E stabilisation notes

Static review of the weekly `E2E stabilization` workflow and the `Public site accessibility (nightly)`
workflow against the green PR browser gates, written without access to the CI logs. Anything below
marked "needs logs" could not be settled from the code.

## What each workflow runs

| Workflow | Selection | Stack |
| --- | --- | --- |
| PR browser gates (`e2e-pr.yml`) | `@smoke\|@roles` then `@public-a11y`, 61 tests in 24 files | api, auth, shop identity, shop api, shop, web; flags off |
| Weekly (`e2e-stabilization.yml`) | `@smoke\|@journey\|@a11y\|@roles`, 236 tests in 47 files, two shards, `flags-off` and `rollout` | api, auth, web, ws; flags off or on |
| Nightly (`public-a11y-nightly.yml`) | `e2e/public-a11y.spec.ts`, `public-chromium` | the deployed `test.lax.bid`, no local stack |

Only the weekly run executes the `@journey` and `@a11y` specs outside the public gate. They are
the specs no pull request exercises, so UI changes break them silently. 26 spec files carry no
`@smoke`, `@roles` or `@public-a11y` tag at all.

## Fixed from the code

- `marketing-header-auth.spec.ts`: the signed-out trigger is named "Account menu" and the
  signed-in one "Account menu, <name>". The spec looked for a signed-out button named exactly
  "Account" (never present) and matched the signed-out button as the signed-in one. It now tells
  the two apart by name.
- `marketing-header-logo.spec.ts`: the header lockup is inline SVG (`svg.lax-lockup` in
  `bid-header-lockup`), not `img.lax-logo-img`. It checks the visible compact mark at 375px.
- `marketing-viewport-audit.spec.ts`: the home cover action is "View lots", "Preview the lots" or
  "See the results" by sale state; "Join the saleroom" no longer exists.

## Differences in the weekly stack that are not the cause by themselves

- No Shop services, no `SHOP_*`/`OIDC_CLIENT_*` shop variables, no shop OIDC clients. The Bid
  specs do not use them.
- It starts the `ws` sidecar and sets `NEXT_PUBLIC_WS_URL`; the PR job does neither. The sidecar
  needs no extra environment (defaults match the job), and `/health/ready` is probed with GET.
- No org-module, alerts or Zoho variable is set in either workflow, so there is no drift there.
- The PR job runs `flush-auth-rate-limits.mjs` immediately before the browser run. The weekly job
  relies on the flush at the end of `prepare-e2e-auth-states.mjs`, then logs in far more often
  across 236 tests. Needs logs: look for 429s from `/api/auth/*` or `/users/me`.

## Needs logs

1. Which tests fail in both modes versus only `rollout`. Specs gated on the process environment
   (`onboarding-a11y.spec.ts`, `bid-flow.spec.ts` strict cases) run only in `rollout`; the
   interests and recommendations pages there have not been opened by any PR.
2. `saleroom-clerk.spec.ts` (needs the seeded hybrid sale, ws and a reconnect): the connection
   chip text is "Connected" then "· Listening"/"· Updated …" in separate spans, so the
   `not.toContainText("Connected · Listening")` check is only meaningful if whitespace between the
   spans is rendered. Suspect only if the reconnect test is red.
3. `marketing-pages-smoke.spec.ts` fails on any critical, serious or moderate axe result in
   `#main-content` for ten pages; the nightly baseline in `a11y-baseline.json` is empty, so a
   single moderate result on any public route fails `public-a11y.spec.ts` too.
4. Nightly 2 and 3 November: it runs against the deployed test site, not the commit under test.
   If the deployment was behind `main`, failures there describe that build. The dl/dt/dd pattern
   in Account is not on a public route. The `dl` blocks on public pages (sale overview, results
   bands, lot facts, cover seasons, artist facts, spec lists) all use `dt`/`dd` pairs, with at
   most a wrapping `div`. Need the report to see the rule and the route.
5. `marketing-prompts.spec.ts` is skipped unless `PLAYWRIGHT_MARKETING_PROMPTS=1`; its mobile
   branch looks for a "Site navigation" dialog that no longer exists (the phone menu replaced
   it). Update it before enabling the flag.
