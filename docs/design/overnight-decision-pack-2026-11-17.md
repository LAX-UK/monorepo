# Overnight decision pack, 2026-11-17

Three build items that can be fully designed now but have no design yet. Each section gives the problem with evidence, the options, one recommendation, numbered decisions to approve, open questions with defaults, a PR plan, risks and a test plan. This is a documentation-only change; nothing here is built yet.

To approve quickly: reply with the decision numbers you accept (for example "A: D1–D5 yes; B: D1–D6 yes; C: D1–D4 yes, D3 with 600 s"). Any open question you do not answer takes its stated default.

| # | Item | Recommendation in one line | Size |
|---|---|---|---|
| A | BA-15 follow-up: online index builds on `domain_events` | Add a non-transactional pre-migration step that builds declared indexes with `CREATE INDEX CONCURRENTLY` before the transactional runner. Do not add trigram indexes. | 1 PR, about 1 day |
| B | FLAKE-9: lax.art loading screens time out at 375 px | Make the loading check follow the loading screen itself, not the first `.lax-skeleton` it finds, and fail fast when the navigation was not held. Do not raise timeouts. | 2 small PRs, about 1 day |
| C | lax.art home shows its loading skeleton with JavaScript off | Prerender the home page with time-based and tag-based revalidation so its HTML has the content inline. | 1 PR, about half a day plus measurement |

---

## A. BA-15 follow-up: online index builds on `domain_events`

### Problem and evidence

PR #942 ("Bid search: escape LIKE patterns and index the searched columns") left this under *Not covered here*: "Trigram indexes on domain_event (event_type, aggregate_id): a large, write-heavy table, better done as a separate online build."

Since then, part of this has been done, and the open part is now different:

- **The index exists, but as a btree, not trigram.** `packages/db/drizzle/0399_domain_events_event_type_aggregate_idx.sql:1-11` adds `domain_events (event_type, aggregate_id)` as a btree (#1484). The header records a trial GIN `gin_trgm_ops` index on 1M rows. The plan stayed a sequential scan for the only LIKE over these columns (the audit-log free-text search, which ORs them with joined actor columns), and the equality lookups were slower through the GIN. **The trigram part of the PR #942 note is therefore answered: no.**
- **The "online" part is still a manual step.** The runner applies each migration inside `BEGIN … COMMIT` (`packages/db/src/migrate-runner.ts:15-22` and `:68-80`), so `CONCURRENTLY` is impossible inside a migration. Both recent `domain_events` index migrations rely on someone running `CREATE INDEX CONCURRENTLY` by hand in psql before the deploy (`0399_…:13-22` and `0400_unapplied_money_shop_payment_idx.sql:13-22`). Otherwise the plain build takes a SHARE lock, which stops inserts into `domain_events` (and so every write path that emits events) for the length of the build.
- **The pattern keeps repeating.** The same "the runner is transactional, so plain CREATE INDEX" note appears in 0297, 0316, 0365, 0384, 0399 and 0400 (`grep -n CONCURRENTLY packages/db/drizzle/*.sql`). `docs/runbooks/perf-baselines.md:66` asks for `CONCURRENTLY` in production for 0115, again by hand.
- **Production runs migrations unattended.** `packages/db/src/migrate-prod.ts:24-27` runs the runner from DigitalOcean App Platform `PRE_DEPLOY` on every release. Nobody is at a psql prompt, so in practice the manual pre-build step is skipped and the write pause happens.
- **The safety net already exists.** `0399_…:25-37` refuses an INVALID index left by a failed concurrent build, and `packages/db/src/migration-0399-0400-online-indexes.integration.test.ts:163` covers adopting a pre-built index. What is missing is something that runs the pre-build automatically.

At today's size the pause is short (1.3 s measured on 1M synthetic rows, `0399_…:15-16`). It grows linearly with the table and lands on the auction bid path, which writes `domain_events`.

### Options

1. **Keep the manual psql step (status quo).** No code. However, the step is skipped whenever nobody remembers it, and the write pause grows with the table. Each new index repeats the header boilerplate.
2. **A non-transactional "online index" step in `migrate-prod.ts`, before the runner (recommended).** Each index migration that wants an online build also ships a small declaration file (for example `packages/db/drizzle/online/0399.sql` holding exactly the `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` statements). `migrate-prod.ts` runs the declarations for *pending* migrations in autocommit mode, one statement at a time, then calls the runner as today. The runner's existing `IF NOT EXISTS` plus INVALID guard adopts the result. If the online step fails, it drops the INVALID index it created and stops the deploy before any migration runs.
   - Pros: it reuses the adoption path and tests that already exist. Migrations stay transactional and replayable. Local, CI and test databases are unchanged because they run the runner only. One place owns `lock_timeout`/`statement_timeout` policy.
   - Cons: a second file per index migration. The step has to be idempotent and safe to re-run after a deploy that was killed halfway.
3. **Let the runner execute some migrations outside a transaction (a `-- lax:no-transaction` marker).** This is the Rails/Flyway approach.
   - Pros: one file, and the migration simply says `CONCURRENTLY`.
   - Cons: it breaks the runner's guarantee that the ledger row and the DDL commit together (`migrate-runner.ts:61-85`). A crash between the index build and the ledger insert leaves state the release-lineage adoption logic (`release-lineage-adoption.ts`) has never had to handle. It also changes behaviour for every environment, not just production.

### Recommendation

**Option 2.** Close the trigram question as "not doing", with the 0399 measurement as the reason, and build the online pre-step so that no future index on a hot table depends on someone remembering psql.

### Decisions to approve

- **D1.** No trigram (GIN `gin_trgm_ops`) index on `domain_events (event_type, aggregate_id)`. The btree from 0399 is the BA-15 answer. The audit-log free-text search is a separate item (see open question Q3).
- **D2.** Online builds are declared in `packages/db/drizzle/online/<migration-tag>.sql`. The file contains only `CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS` and `--> statement-breakpoint` lines. Anything else is a lint failure.
- **D3.** `migrate-prod.ts` runs the online step before `runMigrationsPerTransactionThrough`, only for migrations not yet in the ledger and under the production ceiling.
- **D4.** Session settings for the online step: `lock_timeout = '5s'` (it only waits for the brief locks at start and end of the build), `statement_timeout = 0`, and `application_name = 'lax-online-index'` so it is visible in `pg_stat_activity`.
- **D5.** On failure the step drops only the INVALID index named in the failing statement (`DROP INDEX CONCURRENTLY IF EXISTS`) and exits non-zero, which fails `PRE_DEPLOY` before any migration runs. It never drops a valid index.
- **D6.** The migration file keeps its plain `CREATE INDEX IF NOT EXISTS` and INVALID guard, so local, CI and any environment without the pre-step behave exactly as today.
- **D7.** Backfill: write declaration files for 0399 and 0400 only (still useful for any environment that has not applied them). Earlier migrations are not retrofitted.

### Open questions (with defaults)

- **Q1.** Should the online step also run in the test/staging deploy? *Default: yes.* It is the same `migrate-prod.ts` entry point, and running it there is the rehearsal.
- **Q2.** Maximum time for one online build before the deploy is treated as stuck? *Default: none in code.* App Platform's pre-deploy job timeout is the limit, and the runbook says how to finish the build by hand.
- **Q3.** Should the audit-log free-text search get its own design (for example a generated `tsvector` or a narrower search over `event_type` prefixes only)? *Default: not in this PR. Raise it as a separate ticket if audit-log search latency is reported.*

### PR plan

One PR, "Database: online index pre-step for production migrations":

1. `packages/db/src/online-index-step.ts`: read declarations for pending migrations, validate (D2), run each statement in autocommit with the D4 settings, clean up per D5, and log each index with its duration.
2. `migrate-prod.ts`: call it before the runner (D3).
3. `packages/db/drizzle/online/0399.sql` and `0400.sql` (D7).
4. A lint check (in the existing migration contract tests) that every `online/*.sql` file names an index that its migration also creates with `IF NOT EXISTS`, and contains only allowed statements.
5. A runbook section in `docs/runbooks/` ("Online index builds"): how to watch `pg_stat_progress_create_index`, how to finish or drop a build by hand, and how to roll back.
6. Update the boilerplate paragraph in future index migration headers to point at the runbook instead of repeating psql instructions.

### Risks

- **A concurrent build waits for every open transaction to finish.** A long-running report or stuck session can make the build, and so the deploy, wait. Mitigation: log progress from `pg_stat_progress_create_index`, and the runbook names the query to find the blocker.
- **Twice the I/O of a plain build** (two table scans). This is acceptable at current size. Note it in the runbook for very large tables.
- **Mismatch between the declaration and the migration** (different columns under the same name). The migration's `IF NOT EXISTS` would then silently keep the wrong index. Mitigation: the step 4 lint compares the index definition text, not only the name.
- **Ledger ceiling interaction.** The step must use the same ceiling as the runner, or it could build an index for a migration that will not be applied in this release. Mitigation: pass the resolved ceiling in. A test covers a declaration above the ceiling being skipped.

### How it will be tested

- Unit: declaration parsing and validation (allowed statements only, `IF NOT EXISTS` required, ceiling filtering).
- Integration (`DATABASE_URL`-gated, as the existing 0399/0400 tests are):
  - with an open writer transaction inserting into `domain_events`, the online step completes without blocking the writer's next insert;
  - a forced failure (unique violation on a `UNIQUE` declaration) leaves no INVALID index and a non-zero exit;
  - a re-run after success is a no-op;
  - the runner then applies 0399/0400 and records ledger rows without rebuilding.
- Rehearsal on the test environment deploy, with `pg_stat_activity` checked for `lax-online-index`.

---

## B. FLAKE-9: lax.art loading screens time out at 375 px

### Problem and evidence

The lax.art loading-screen spec (`apps/art/e2e/loading-screens.spec.ts:6-13`) checks five routes (home, art-hub, collector-hub, visit, how-to-buy) at 1440 and 375, light and dark: 20 tests through the shared helper `packages/e2e-utils/src/loading-check.ts`. CI runs it on every lax.art PR with `PLAYWRIGHT_LOADING_CHECK=1` (`.github/workflows/art-e2e-pr.yml:162-166`), with one worker and two retries (`apps/art/playwright.config.ts:11-12`). FLAKE-9 is that the art-hub, collector-hub, visit and how-to-buy cases time out at 375.

Evidence from the code and from the latest green merge-queue run (run 43983789416, job 133706786126, all 20 passed):

- **The check finds "the loading screen" by the first `.lax-skeleton` on the page** (`loading-check.ts:178` and `:182`). The comment at `:179-181` already notes that pages also draw `.lax-skeleton`, for images that have not loaded yet. If the held navigation does not actually show the route's loading screen, `screenBlock` becomes a page image placeholder instead. At 375, a placeholder below the fold belongs to a lazy image that never loads, so `waitForFunction(!block.isConnected)` at `:192` waits its full 30 s and fails. At 1440 more images are in view and load, so the same mistake passes. This matches a timeout that appears only at 375 and only on image-heavy pages.
- **Nothing asserts that the navigation was held.** `holdNavigation` (`:60-75`) holds only an RSC request without `next-router-prefetch`. If the router already has the full page cached (a visible `<Link>` that prefetched it fully, for example the phone tab bar or menu at 375), the click sends no RSC request, nothing is held and no loading screen appears. The test goes on and measures the wrong thing.
- **The prefetch wait silently costs 10 s when the route is already prefetched** (`:82-101`, timeout at `:88`). In the green run every case that already had the link on screen took ~14.7 s against ~4.7 s for the rest. At 1440 that was home, art-hub and collector-hub; at 375 only home. So which links are on screen differs by width, and so does which code path each case takes.
- **Time budget.** Each test has 90 s (`:274`). Each 375 case can spend 10 s (prefetch) + 2.2 s (hold) + 30 s (swap wait) + network idle, and on a retry with `trace: on-first-retry` it runs slower again.

I could not find a failing run in the last 15 completed `art-e2e-pr.yml` runs, so the "page placeholder taken as the loading screen" cause is a well-supported hypothesis, not a confirmed one. The first PR below is designed to confirm or rule it out on the first failure.

### Options

1. **Raise timeouts or retries for 375.** It is cheap, but it hides a test that sometimes measures the wrong element, so it gives false passes as well as slow failures. Rejected.
2. **Make the check follow the loading screen itself and fail fast when there is none (recommended).**
   - Every route `loading.tsx` root gets a marker, `data-lax-loading-screen`, through the shared skeleton components.
   - The check waits for `[data-lax-loading-screen]` instead of `.lax-skeleton` and takes `screenBlock` from inside it.
   - It records whether the held request was seen. If no request was held, or no loading screen appeared within 5 s of the click, it fails at once with a message that names which of those happened.
   - It skips the 10 s prefetch wait when the router already holds the route.
3. **Drop the 375 viewport for lax.art, or move these cases to a nightly job.** This removes the symptom and also the phone coverage that MO12 asks for (`docs/design/motion.md:51`, `:73`). Rejected.

### Recommendation

**Option 2**, in two steps: first add the diagnostics so the next failure names its cause, then make the fix. Both steps live in the shared helper, so Bid and Shop loading specs get the same protection.

### Decisions to approve

- **D1.** Add the attribute `data-lax-loading-screen` to the root element of every route loading screen (kit `Skeleton` page layouts and lax.art's `art-route-skeletons.tsx`). It is test-facing and inert: no styles may select it (a one-line check added to the existing UI guardrail lint).
- **D2.** `checkLoadingScreen` waits for `[data-lax-loading-screen]` and reads skeleton blocks only inside it. `.lax-skeleton` outside the screen is ignored.
- **D3.** `holdNavigation` returns whether it held a request. If the loading screen has not appeared within 5 s of the click, the check fails with "navigation not held" or "loading screen not shown", plus the URL and the requests seen.
- **D4.** Replace the 10 s prefetch wait with a check that the route is already in the router's prefetch cache. If it is, skip the wait. If it is not, wait up to 10 s as today.
- **D5.** Keep the 30 s swap wait, the 90 s test budget and the 0.1 swap budget unchanged. The fix must not loosen any assertion.
- **D6.** Close FLAKE-9 only after 20 consecutive green CI runs of the lax.art loading spec with zero retries used (the run summary already prints one `[loading-check]` line per case).

### Open questions (with defaults)

- **Q1.** Use a new attribute or a dedicated class (`.lax-loading-screen`)? *Default: the attribute.* A class invites styling, and D1 wants the marker to be inert.
- **Q2.** Should the step 1 diagnostics also upload the held-request log as a CI artefact? *Default: yes, only on failure, inside the existing `art-pr-playwright-report` artefact.*
- **Q3.** Should Bid and Shop specs take the change in the same PR? *Default: yes.* The helper is shared and their screens use the same kit components. Their CI runs must stay green.

### PR plan

1. **PR 1, "Loading check: report what it measured"** (test code only). Record in the annotation whether the request was held, which element `screenBlock` was (its closest route-segment ancestor, its class list and whether it was in the viewport), and each phase's duration. No behaviour change. Merge it, then read the first failing run.
2. **PR 2, "Loading check: follow the loading screen, fail fast when it is not shown"**. D1 marker in the kit and lax.art skeletons, D2–D4 in `loading-check.ts`, and helper unit tests. The PR description includes the before/after case durations from CI (expected: the 10 s cases drop to about 5 s, and the full lax.art loading step gets shorter).

### Risks

- **The marker changes the DOM of every loading screen.** It adds one attribute, with no layout or paint effect. The existing skeleton Chromium suite (`packages/ui/src/lax/skeleton-resolved.test.ts`) runs unchanged.
- **D4 relies on Next router internals** (the prefetch cache). Mitigation: if the internal check is unavailable, fall back to today's 10 s wait, so a Next upgrade can only slow the test, never break it.
- **The real cause may be different** (for example runner CPU starvation). PR 1 exists to show this before PR 2 is merged. If the PR 1 data contradicts the hypothesis, PR 2 is redesigned before it is built.

### How it will be tested

- Helper unit tests with a fake page: no held request leads to a fast "navigation not held" failure; a page placeholder outside the marker is ignored; a cached route skips the prefetch wait.
- A deliberate negative case run locally: remove `apps/art/src/app/art-hub/loading.tsx` on a scratch branch, and the check must fail in under 10 s with "loading screen not shown", not after 30 s.
- CI: lax.art, Bid and Shop loading specs green. The D6 tally is kept in the FLAKE-9 ticket.

---

## C. lax.art home shows its loading skeleton with JavaScript off

### Problem and evidence

- PR #1502 (Motion 6/8) lists as a follow-up: "lax.art home with JavaScript off shows its route `loading.tsx` fallback, because the streamed page content needs JavaScript to swap in (same on main). The server HTML has the full content."
- The home page is the main search landing page. Its metadata keeps the legacy site's ranking intent ("London Art Gallery | Original Art for Sale", `apps/art/src/app/(home)/page.tsx:33-39`).
- It renders dynamically: `export default async function ArtHomePage()` awaits `composeArtHomePage(artServices)` (`page.tsx:191-192`) and declares no `revalidate`. A route `loading.tsx` wraps it (`apps/art/src/app/(home)/loading.tsx:1-5`, the catalogue skeleton).
- So every first visit is streamed. The skeleton is the visible HTML, and the real content sits in a hidden streamed segment that only an inline script reveals. Clients without JavaScript, and crawlers or link-preview fetchers that do not run JavaScript, see a skeleton, with the real content in a `hidden` block. First paint for real visitors also waits on the swap.
- The app already has an on-demand revalidation endpoint (`apps/art/src/app/api/revalidate/route.ts`), so cache invalidation on content changes is a solved problem in this codebase.

### Options

1. **Prerender the home page (ISR): `export const revalidate = 300` plus tag invalidation from `/api/revalidate` when catalogue or editorial content changes (recommended).**
   - Pros: a statically rendered page resolves its Suspense boundaries at render time, so the served HTML has the content inline and no fallback. TTFB gets faster. `loading.tsx` stays for in-app navigation to home, so the MO12 loading screen is unchanged.
   - Cons: content can be up to `revalidate` seconds stale if a tag is missed. The page must not use request-time APIs (cookies, headers, search params).
2. **Remove the route `loading.tsx` for home and put `<Suspense>` only around the data-driven sections.** The hero and shell then render in the first chunk, but the data sections are still hidden without JavaScript. This is a partial fix and changes the MO12 loading screen for home.
3. **A `<noscript><style>` that reveals Next's hidden streamed segment and hides the fallback.** No architecture change, but it depends on Next's private markup (`hidden` segments with generated ids), which can change in any minor release. Rejected.

### Recommendation

**Option 1**, provided the composer uses no request-time API (checked in the first step of the PR plan). If it does, move only that part into a small client island and still prerender the rest. Fall back to Option 2 only if that split is not possible.

### Decisions to approve

- **D1.** The lax.art home page is prerendered with ISR (`revalidate` per Q1) and must stay static. The build output marks `/` as static or ISR, and CI fails if it becomes dynamic.
- **D2.** Catalogue and editorial writes that change home content revalidate a `home` cache tag through the existing `/api/revalidate` route.
- **D3.** `(home)/loading.tsx` stays, so in-app navigation to home keeps its loading screen and the lax.art loading spec's `home` case stays as is.
- **D4.** Acceptance: with JavaScript disabled, `/` shows the hero heading and the first section titles, with no `.lax-skeleton` drawn in the first viewport, at 1440 and 375.

### Open questions (with defaults)

- **Q1.** Revalidate period? *Default: 300 s.* Tag invalidation (D2) makes most updates immediate, and the period is a safety net.
- **Q2.** Does `composeArtHomePage` or any child read cookies, headers or the session (for example a signed-in greeting or favourites state)? *Default assumption: no.* The first PR step verifies this from the build output. If yes, that part becomes a client island.
- **Q3.** Apply the same treatment to the other lax.art marketing routes with loading screens (art-hub, collector-hub, visit, how-to-buy)? *Default: not in this PR.* Measure home first, then decide per route.

### PR plan

One PR, "lax.art home: prerender so the HTML carries the page":

1. Build lax.art and record whether `/` is dynamic, and why (Next prints the reason when a page opts into dynamic rendering).
2. Add `revalidate` and the `home` tag on the composer's data reads, and wire the tag into `/api/revalidate`'s callers.
3. Add the D1 build-output check to the lax.art CI build step.
4. Add an e2e test with JavaScript disabled (D4).
5. Before/after evidence in the PR: TTFB and LCP for `/` on the seeded stack (same method as #1502), and the JS-off screenshot at 1440 and 375.

### Risks

- **Stale content** when a write path does not revalidate the tag. Mitigated by the 300 s ceiling and by listing every home data source in the PR.
- **Build-time data access.** Prerendering at build needs the Shop API reachable during `next build`. If it is not (as in some CI jobs), use the "render on first request, then cache" form (`generateStaticParams` is not needed for `/`). The PR states which applies.
- **The seeded CI stack shows seed data at build time.** This affects tests only. Production builds read production data at regeneration.

### How it will be tested

- The build-output check (D1) in CI.
- New e2e test (JavaScript disabled, 1440 and 375): hero heading and section titles visible, no skeleton in the first viewport.
- The existing lax.art loading spec `home` case still passes (in-app navigation keeps its loading screen).
- A revalidation integration test: calling `/api/revalidate` with the `home` tag changes the served HTML on the next request.

---

## Not chosen tonight

- **Bid `/sales` redirect blank frame** (#1485 follow-ups). Real, but `swapNotAsserted` already contains it, and it needs a product decision about the live tab first.
- **Hand-rolled `animate-pulse` placeholders** in Bid and LAX Account (#1485 follow-ups). Mechanical migration work; no design decision needed.
- **`MediaImage` hatched placeholder with JavaScript off** (#1502 follow-ups). Small visual effect (under 1% of pixels). It is better solved after item C settles the general approach to no-JavaScript rendering.
