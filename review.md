Verdict: FIX FIRST

# Review of PR #1494: CI: deterministic route JavaScript sizes and a base-vs-head table

Reviewed head `15ecc9f7` (2 commits on merge-base `8ed75236`). This was a review only: nothing was pushed to the PR branch and no comments were posted.

Summary: the pins work. Two clean builds of one commit at the **same path** produce byte-identical output, and no budget, ratchet or tolerance was loosened. But the base is built in a git worktree at a **different absolute path** from the head. Next 15's server action ids depend on the file path, so base and head builds are not like for like. The PR's own CI run reports dozens of routes "growing" by 1 to 60 bytes, although the PR changes no client code. The table therefore does not do what it promises: "any number is a real change". For motion and performance PRs, this noise can cause false failures, or hide real growth of a few bytes.

## Blocking

1. **The base build is not like for like with the head: the checkout path leaks into client JavaScript.**
   - The head is built in `$GITHUB_WORKSPACE`. The base is built with `git worktree add --detach "$RUNNER_TEMP/route-js-base"` (`.github/workflows/ci.yml:1107-1108`).
   - Reproduced locally:
     - I built `apps/account` twice at PR head with exactly the CI pins (`ROUTE_JS_SIZE_BUILD=1`, the all-zero `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, the placeholder DSN, different `GITHUB_SHA`), using `turbo --force` and a clean `.next`. Result: **0 of 20 routes changed, client scripts byte-identical**.
     - I then built the **same commit** in a worktree at another path with the same env. Result: **15 of 20 routes changed** (`/account/profile/page` +92 B, `/account/security/delete/page` +25 B, `/account/selling/editions/page` +19 B, …).
   - Cause, from diffing `static/chunks/1612-*.js`:
     - The server action id inlined by `createServerReference(...)` differs (`00a220eb…` against `00371dad…`). Next 15.5.9 hashes the action id from the key **and the module path**.
     - The Sentry `_sentryDebugIds` UUID is derived from chunk content, so it changes as well.
     - The chunk content hashes then change, and so does the webpack runtime that lists them.
   - CI confirms it. In run 43839857505 (job `build`, 133206534121), "Route JavaScript base vs head" emits `::notice` growth for most routes of `apps/web`, `apps/account`, `apps/art` and `apps/shop-admin`, for example:
     - `apps/account /account/security/page grew by 49 bytes`
     - `apps/shop-admin /(staff)/clients/[partyId]/page grew by 60 bytes`
     - `apps/web /(marketing)/search/page grew by 29 bytes`

     This PR changes no client source.
   - Part of that first run also comes from the old-base path, which pins the release through `SENTRY_RELEASE` with `--force --env-mode=loose` (`ci.yml:1112-1116`). The path effect alone persists after merge, so this is not a one-time transition cost.
   - Impact:
     - A motion or perf PR whose app has server actions on start-up routes can fail with growth it did not write, which makes the gate **flaky**.
     - Path noise can also cancel out a real few-byte growth, so the "even one byte" rule can **pass a PR it should fail**. The gate is weaker than the docs say.
     - When an app is instead replayed from the remote cache (built by the merge queue in `$GITHUB_WORKSPACE`), the noise disappears. The result then depends on whether the cache was hit.
     - The docs claim at `docs/engineering/route-js-budgets.md:390` ("Any number in the table is a real change… there is no noise") is false today.
   - Fix (one of):
     - Build the base at the same absolute path as the head. For example, write the head report, `git checkout --detach $BASE_SHA` in `$GITHUB_WORKSPACE` with a clean install, build, report, then check the head back out.
     - Or build both head and base from one fixed path.

     Then add a CI self-check: build the head a second time through the base route (or point `BASE_SHA` at `HEAD`) and require `0 changed` once, or document that check as part of the proof. Re-run CI on this PR and confirm that **every** table block reads `0 of N routes changed`, except the documented Bid admin split-chunk digest difference.

2. **The determinism proof does not cover the CI topology.** The PR body and `docs/engineering/route-js-budgets.md:356-371` prove determinism for two builds in one checkout. The CI comparison never builds that way (see 1). The local reproduction recipe at `route-js-budgets.md:412` also builds both sides in place, so it cannot catch this. Once 1 is fixed, update the proof and the recipe to match what CI does.

## Non-blocking

- **Cache key misses the build settings.** The base-report cache key (`ci.yml:1090`, `ci.yml:1128`) covers the base SHA, apps and measuring scripts, but not the size-build `env` in `ci.yml`, `turbo.json` or the apps' `next.config.ts`. If a PR changes a pin, a restored base report from an earlier push can be stale against a head built with different settings. Add `hashFiles('.github/workflows/ci.yml', 'turbo.json')` or a version bump to the key.
- **New routes are not growth.** `grown` only counts routes present on both sides (`scripts/route-js-size-compare.mjs:109`). A motion PR that adds a page route passes this step; it is still subject to the existing budgets. MO14 says "no growth on any route". Decide explicitly, and document whether a new route on a motion PR should fail.
- **Opt-in is by title word or label** (`route-js-size-compare.mjs:26`). That matches the existing convention in `docs/design/motion.md`, but renaming a PR or dropping a label turns the check off. Consider also keying on the motion-system PR series, or on paths such as `packages/ui/motion`. False positives (any title with "motion") only make it stricter, which is acceptable.
- **The summary sentence is ungrammatical.** It renders as `This PR is title mentions "Motion"` (`route-js-size-compare.mjs:160-161` together with `noGrowthReason`). Reword it to something like `This PR counts as motion/performance work (title mentions "Motion")`.
- **Inline workflow logic is untested.**
  - The `node -e` app/filters calculation in "Route JavaScript base" (`ci.yml:1067-1077`) and the missing-base fallback (`ci.yml:1153`) are inline, so the 53 node tests do not cover them. Move them into `route-js-size-compare.mjs` (or a small helper) with tests.
  - `parseLabels` calls `JSON.parse` outside the `try` block (`route-js-size-compare.mjs:54`), so a malformed `PR_LABELS` exits 1 with a stack trace instead of the documented exit 2.
- **CI time.** On this PR, "Build" took 10m51s and "Build the base for route JavaScript" took 10m03s (an uncached old base). The `build` job went to about 21.6 minutes.
  - After merge, the base should mostly replay from the remote cache (`TURBO_CACHE` is `remote:r` on PRs and `remote:rw` in the merge queue, `ci.yml:26`). On a miss it adds up to about 10 minutes per PR per new base, and the job also runs a second `pnpm install`.
  - Nothing saves a base report from `main`, so every PR builds or replays its base at least once.
  - The fix for blocking item 1 must not throw away remote-cache reuse. Path-independent turbo hashes mean a same-path base build can still replay.
- `continue-on-error: true` on the base build (`ci.yml:1100`) is fine for non-motion PRs. For motion PRs the missing base fails, which is correct. A warning is emitted in both cases.

## Verified

- **No rule was loosened (check 1).**
  - `scripts/route-js-budgets.json`, the ratchet baseline, `scripts/check-route-js-budget.mjs`, `route-js-ratchet-rule.mjs` and `route-js-budget-rule.mjs` are untouched (`git diff --stat 8ed75236 15ecc9f7`).
  - The "Route JavaScript budgets" step is unchanged and still runs after Build (`ci.yml:1047-1048`).
  - The new step only adds a failure mode (motion and perf PRs); it never skips or overrides the budget step.
  - The docs update to `docs/design/motion.md:63` keeps "never raise budgets/baselines" and "must not use the 1 KB noise allowance".
  - The pinned release name makes measured routes about 20 to 31 bytes **larger** than an unpinned build. My unpinned `apps/account` control was 20 to 31 bytes smaller per route, so the budget step is slightly stricter, not looser.
- **Pins are confined to size builds and safe for a public repo (check 2).**
  - `ROUTE_JS_SIZE_BUILD=1` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=AAAA…A=` (32 zero bytes, clearly a placeholder) are set only in the `build` job env of `ci.yml` (`ci.yml:1005-1006`).
  - A grep of every workflow, Dockerfile and script finds them nowhere else.
  - The deploy path is `app-deploy-test.yml` / `app-deploy-prod.yml` → `build-images.yml` → the app Dockerfiles. It sets `SENTRY_RELEASE=${SHA}` and neither variable, and runs `turbo run build` inside Docker without the CI remote-cache token.
  - Both variables are now in `turbo.json` `tasks.build.env` (`turbo.json:191-192`), so size builds hash differently from any build without them, and no cache artifact can cross over.
  - The `next.config.ts` change in all five apps only takes effect when `ROUTE_JS_SIZE_BUILD === "1"`.
  - The DSNs stay on the reserved `.invalid` host.
  - No secret is introduced. PR title and labels reach shell and node only through `env`, not `${{ }}` interpolation in `run`, so there is no script injection.
  - The job permissions narrow to `contents: read`, `id-token: write` and `pull-requests: read` (`ci.yml:986-989`).
- **The pins remove the build-to-build noise (check 3, same path).** I reproduced this with `apps/account`, as described in blocking item 1: two clean builds produced 0 of 20 changed routes and byte-identical client scripts. An unpinned build of the same commit produced 20 of 20 changed routes. The build-id placeholder in the digest (`scripts/route-js-size-report.mjs`, the `<build-id>` mapping) works as described.
- **Base selection is correct (check 4).** On `pull_request`, CI checks out the test merge commit, so `HEAD^1` is main at run time (`ci.yml:1062-1066`). The base and head build the same app set, filtered to apps that exist at the base. The `merge-base HEAD main` fallback is only reached when `HEAD` is not a merge commit.
- **Readable summary (check 4).** The compare step writes a Markdown table per app to `GITHUB_STEP_SUMMARY`: base KB, head KB, delta KB and delta bytes, sorted by growth, with `new` and `removed` rows. Exit codes are 0 for report, 1 for motion growth and 2 for bad input.
- **Docs and tests (check 6).**
  - The new "Base vs head" section (`docs/engineering/route-js-budgets.md:335-420`) explains the sources, how to read the table and what fails.
  - `pnpm lint:route-js-budget` passes locally: 53 tests, 0 failures. That includes the 9 new tests in `scripts/route-js-size-compare.test.mjs`.
- **CI on the PR.** Run 43839857505 is green, `build` included: the PR itself is not a motion PR, so the growth notices did not fail it. That green result does not show the comparison is correct (see blocking item 1).

## Final recheck

Rechecked on 2026-11-16 at head `a32f9e03` (6 commits on merge-base `8ed75236`; 4 new since the review above: `b8220428`, `7bdd3f04`, `9bc842c9`, `1ecf023e`, then the docs-only `a32f9e03`). This was a review only: nothing was pushed to the PR branch and no comments were posted.

**Verdict: FIX FIRST.** The structural fix is right and works. The base is now built in the head's own checkout, and the latest CI base-vs-head table reads 0 changed routes in all five apps. But the new self-check, which is the PR's own proof of determinism, failed on the latest completed run: Account showed 20 of 20 routes 2 bytes apart across two builds of one commit, so CI is red. The PR's answer is a docs commit that tells reviewers to read uniform 1 to 2 byte moves in Bid and Account "as variation, not as a change" and to re-run until the check passes. That is a noise allowance in prose, on exactly the PRs (motion/perf, MO14 "no growth, even 1 byte") the gate exists for. The PR body also has no "Changes after review" section, and its proof table is now contradicted by its own docs.

### Blocking items from the review above

| Item | Status | Evidence |
| --- | --- | --- |
| 1. Base built at a different path | **Fixed** | `scripts/route-js-size-build-base.sh` checks the base out in `$GITHUB_WORKSPACE` (`git checkout --force --detach`, `git clean -ffdx -e .turbo/cache`, clean `pnpm install`). It builds and reports the base, then restores the head from an `EXIT` trap, even on failure. The measuring scripts run from a copy in `$RUNNER_TEMP/route-js-tools`. The cache key is now `v2` and includes `ci.yml` and `turbo.json`. |
| 1. No-op table must read 0 B on every route | **Fixed in the latest run, not in the one before** | Run 43877647575 (job 133335935750, base `697f2d8d5e`, head `082f6362f6`): web 0/114, shop 0/39, art 0/43, account 0/20, shop-admin 0/51, with no growth notices. The earlier run 43869364824 (job 133307290744, base `6f49e6ed`) showed **all 114 Bid routes +1 byte**, with 114 `grew by 1 bytes` notices, while the other four apps were byte-identical. My own local reproduction (below) gave 0 B. |
| 2. Determinism proof must cover the CI topology | **Not met** | The self-check is the right design (the head built a second time through the base route with `--force`, then `--require-unchanged`). It passed in run 43869364824 (all apps 0 of N) but **failed** in run 43877647575: `apps/account: 20 of 20 routes changed`, every route −2 bytes (for example `/account/profile/page 446354 -> 446352`), exit 1. Both sides were uncached (`Cached: 0 cached, 42 total`). Account was documented as byte-identical. The build is therefore not deterministic in CI, and the cause is unknown (`a32f9e03`: "The cause is not found yet"). |

### My own checks

- **No-op, local, Bid (CI topology).** In one checkout with the CI pins, I built `apps/web` at the head (`1ecf023e`), then built the base `8ed75236` through the PR's `route-js-size-build-base.sh` (the pre-pin path, uncached). Then I ran the compare with a motion title: **0 of 114 routes changed, client scripts byte-identical, exit 0.** Head build 8m44s, base build 9m39s on 4 vCPU.
- **Mutation, local, Account.** I built `apps/account` at the head and reported it. I then added a client component with about 4.5 KB of incompressible data to `/account/security/page` only, rebuilt and reported again.
  - The table shows exactly 1 of 20 routes changed: `/account/security/page` +5257 bytes (+5.13 KB).
  - With title "Motion system 4/8: page transitions", the step **fails (exit 1)** and names the route: `error: apps/account /account/security/page grew by 5257 bytes (5.13 KB gzip) against the base`.
  - With a non-motion title, it reports `::notice` and exits 0, leaving pass/fail to the budget step, as documented.
  - The mutation was made in a scratch worktree only and was not pushed.
- **No rule loosened in code.**
  - `git diff 8ed75236 a32f9e03` is empty for `scripts/route-js-budgets.json`, `scripts/route-js-baseline.json`, `check-route-js-budget.mjs`, `route-js-ratchet-rule.mjs` and `route-js-budget-rule.mjs`.
  - `toleranceKb` is still 1.
  - The "Route JavaScript budgets" step is unchanged and runs before the base build.
  - `node --test` of all 7 route-JS test files: 62 tests, 0 failures. That includes the new `route-js-size-base.test.mjs`.
- **The rule was loosened in docs.** `docs/engineering/route-js-budgets.md` (from `1ecf023e` and `a32f9e03`) now says:
  - "read a Bid or Account block where every route moves by the same one to a few bytes as this variation, not as a change";
  - a motion PR failing that way should "re-run the job, and if it repeats, the growth is real".

  This contradicts "There is no tolerance" a few lines below, and MO14's "no growth on any route, even 1 byte". A real 1 to 2 byte growth of a shared chunk moves every route by the same amount, so it looks exactly like the documented "variation" and can be waved through, or re-run until a lucky pass. The 1 KB allowance was not widened, but this is a new, unbounded, reviewer-judged allowance for Bid and Account. It must go: either make the builds deterministic, or make the gate deterministic about its own noise. For example, fail closed and report "self-check noisy, table not trusted" instead of advising re-runs.
- **Workflow security.**
  - No `${{ }}` of untrusted input in any new `run:`. The PR title and labels go through `env`, and the base step reads them back with `gh api` and `jq`.
  - Permissions are unchanged (`contents: read`, `id-token: write`, `pull-requests: read`).
  - No new secret. `TURBO_TOKEN` and the cache signature key were already workflow-level env before this PR.
  - The actions cache entries are written from the PR ref only, so they cannot poison main.
  - New actions `actions/cache/restore@v4` and `actions/cache/save@v4` use major tags, not SHAs. That matches this workflow's convention for GitHub-owned actions; only third-party `dorny/paths-filter` is SHA-pinned. Acceptable. Pin them to a SHA if the repo policy requires full pinning.
  - The script runs `git clean -ffdx` and `checkout --force` in the workspace. That is fine in CI, because nothing after these steps in the `build` job uses `.next`. The docs warn local users to commit or stash first.
- **CI time.** The `build` job took 50m (run 43869364824) and 40m40s (run 43877647575), against about 11 minutes for Build alone before this PR.
  - Base build: 16m08s and 13m20s, uncached (`0 cached, 42 total`).
  - Self-check: 16m29s and 13m28s.
  - The docs say the self-check adds "about 10 minutes". CI shows 13 to 16.5, so update the number.
  - The base cost on a remote-cache miss after merge, and how often a replay actually hits, are not measured or documented anywhere. Neither run on this PR replayed anything, because the base predates the pins.
  - Roughly doubling the `build` job on a remote-cache miss is acceptable only if it is stated. Document the expected steady-state numbers, or measure them on the first post-merge PRs.
- **CI status.**
  - Run 43877647575 (head `1ecf023e`): `build` **failed** at the self-check.
  - Run 43885016959 (head `a32f9e03`, docs-only) was still in progress at the time of this recheck. A pass there would be one more sample of a check now known to be flaky, not proof.
- **PR body.**
  - There is **no "Changes after review" section.**
  - The body still claims "0 of 114 changed" and "client scripts byte-identical" for Account, and "No route changes" for the Bid limit.
  - It does not mention the +1 B Bid run, the −2 B Account self-check failure or the re-run advice, all of which are now in the docs.
  - The non-blocking items from the review above that were addressed should be listed there: cache key, new routes now count as growth, motion source paths, inline logic moved into tested `route-js-size-base.mjs`, missing-base handling.

### To ship

1. Find the Account (and Bid) build-to-build source, or make the gate not depend on it. Then show two consecutive green runs where the self-check reads 0 of N in **every** app and a no-op base-vs-head table reads 0 B on every route.
2. Remove the "read uniform 1 to few byte moves as variation" and "re-run until it passes" guidance for motion and perf PRs. Restore "any number is a real change", or replace it with a fail-closed rule.
3. Correct the CI time numbers in the docs and state the steady-state cost.
4. Add an honest "Changes after review" section to the PR body. It should list what changed since `15ecc9f7`, the remaining variation, the failed self-check run, and correct the proof table claims.

## Final recheck (round 3)

Rechecked on 2026-11-16 at head `46c23a6b`. Two code commits since the last recheck: `2acab89e` (webpack tie order, a fail-closed self-check, and docs) and `46c23a6b` (Sentry debug ids derived from the chunk's code), plus the merge `7507c0dc`. This was a review only: nothing was pushed to the PR branch and no comments were posted.

**Verdict: FIX FIRST, for the PR body only.** The code and docs are now ready to ship. Size builds are deterministic in CI and locally, CI on the head is green, the docs fail closed, and no rule was loosened. But the PR description still describes the state before round 3. It says the variation is "Not solved yet". It tells readers that "a block where every route moves by the same 1 or 2 bytes is that variation, not a change". It says CI is red and recommends finding the cause before merge. Its "Changes after review" section does not mention `2acab89e` or `46c23a6b`. A reviewer reading the body would get the opposite of the truth, and the body still carries the noise allowance the docs removed. Updating the body is the only fix needed. No code change and no new CI run.

### Evidence

- **Two builds of the same commit at the same path are byte-identical (local).**
  - I ran the PR's own `route-js-size-build-base.sh --force` twice in this one checkout, at `46c23a6b`, for all five apps.
  - Settings were the CI `build` job env: `ROUTE_JS_SIZE_BUILD=1`, the all-zero `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, the `.invalid` DSNs and `NODE_OPTIONS`.
  - Each build had a clean install and `Cached: 0 cached, 42 total`. The two builds had different `GITHUB_SHA` values, and turbo ran with `--concurrency=2`. The default concurrency ran out of memory on 4 vCPU/15 GB, as the docs warn.
  - Build times: 16m30s and 16m14s.
  - `route-js-size-compare.mjs --require-unchanged`, exit 0: **web 0/114, shop 0/39, art 0/43, account 0/20, shop-admin 0/51, client scripts byte-identical in every app**.
  - `main` itself has no pins or plugin yet, so "build main twice" can only be shown at this head. Building `main` twice would only reproduce the known unpinned variation.
- **Base and head are built at the same path.** `scripts/route-js-size-build-base.sh` checks the base out in `$GITHUB_WORKSPACE` and builds it there. The measuring scripts run from `$RUNNER_TEMP/route-js-tools`. In CI, the base, self-check and head all build under `/home/runner/work/monorepo/monorepo`. No worktree is left.
- **CI on the head.** Run 43944637053 concluded **success**, and every job passed.
  - The `build` job took 48m48s: Build 16m43s, base build 15m44s (the pre-pin base, uncached), self-check 15m46s (`0 cached, 42 total`).
  - Base vs head: web 0/114, shop 0/39, art 0/43, account 0/20, shop-admin 0/51, all byte-identical, with no growth notices.
  - Self-check: the same five blocks read 0 changed and byte-identical. "Self-check passed".
  - The previous run 43929156339 (`2acab89e`) also passed, with exactly the same result.
  - That makes two consecutive green runs with a clean self-check and a clean no-op table in every app, which was item 1 of "To ship" above. The earlier failures (Account −2 B, Bid −1 B, Shop −2 B) did not recur.
- **The cause is found and fixed, not hidden.**
  - `DeterministicSizeBuildPlugin` (`packages/observability/src/next-size-build.ts`, unit-tested) sorts `compilation.entries` and `compilation.modules` by name before webpack settles ties. It also replaces each Sentry debug id, at `PROCESS_ASSETS_STAGE_ADDITIONS + 1` and before minification, with a UUID of the same length and format derived from the chunk's code.
  - It is added only to client production builds when `ROUTE_JS_SIZE_BUILD === "1"` (`addSizeBuildDeterminism`).
  - The docs record its effect against Sentry's own ids: −10 to +37 B per route (mean +7). It applies to base and head alike. The budget step reads these builds, so the change is mostly stricter, only negligibly looser, and far inside the existing 1 KB `toleranceKb`, which is unchanged.
- **The docs no longer advise re-running or reading moves as variation.**
  - `docs/engineering/route-js-budgets.md` now says "**any number in the table is a real change made by the PR**, even one byte, and even when every route of an app moves by the same amount… There is no tolerance and no noise to allow for."
  - It also says "Re-running until it passes is not a fix", and "Growth is never waved through as variation".
  - The self-check now also fails when client scripts differ (`selfCheckFailures` counts `!identical` apps), and its message says the table is not trusted.
  - The only remaining "re-run" advice is to re-run after adding a label, or once a missing base builds. Both are correct.
  - Nit: "What CI does" step 3 still says the pre-pin base gets the head's `next.config.ts`, "whose only size-build change is the pin". The script now also copies the plugin module. Not blocking.
- **CI time figures.**
  - The docs' "CI cost" table matches the three runs it cites. Build: 16m39s, 13m14s, 15m22s. Base: 16m08s, 13m20s, 14m40s. Self-check: 16m29s, 13m28s, 14m44s. Job: 49m54s, 40m39s, 45m26s.
  - It states the steady-state cost (a few minutes on a remote-cache hit, up to about 16 minutes on a miss, about 30 more minutes for a self-check PR) and that the hit rate still needs measuring.
  - The latest run is slightly above the stated range (Build 16m43s, job 48m48s).
  - The **PR body** is wrong. It says "a base or self-check build costs about 10 to 16 minutes". The measured range is 13m14s to 16m43s.
- **No rule loosened, no allowance used.**
  - `git diff` from the merge-base to `46c23a6b` does not touch `scripts/route-js-budgets.json`, `scripts/route-js-baseline.json` (`toleranceKb` is still 1), `check-route-js-budget.mjs`, `route-js-ratchet-rule.mjs` or `route-js-budget-rule.mjs`.
  - The changed files are only the CI workflow, the five `next.config.ts` files, `turbo.json` (two env names), `package.json` (two test files added to `lint:route-js-budget`), `packages/observability` (the new plugin and its export), the `route-js-size-*` scripts and tests, and the docs.
  - MO14 in `docs/design/motion.md` still says to never raise budgets or baselines and that motion PRs must not use the 1 KB allowance.
- **The pinned key is not a secret leak.**
  - `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: AAAA…A=` (32 zero bytes) appears only in the `build` job env of `.github/workflows/ci.yml:1009`. Besides that, it is only listed by name in `turbo.json`'s build env.
  - A grep of the deploy workflows, `build-images*` and every `Dockerfile*` at `46c23a6b` finds neither `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` nor `ROUTE_JS_SIZE_BUILD`. Deploy images build inside Docker without them, so Next generates its own key there.
  - Listing the variable in turbo's env only adds its hash to the task hash. It also keeps size builds from ever sharing cache entries with deploy builds.
  - The docs now explain why the value is safe to make public, and that any workflow deploying a size build would need its own key.

### Still to fix: the PR body (no code change)

1. Rewrite the "Not solved yet — CI builds still vary" paragraph and the "Result against the goal" list. The variation is now fixed by `DeterministicSizeBuildPlugin`: the tie order in `2acab89e` and the debug ids in `46c23a6b`. Above all, delete "a block where every route moves by the same 1 or 2 bytes is that variation, not a change". The docs now say the opposite, correctly.
2. Add the webpack tie order and the Sentry debug ids as rows to the "Sources of non-determinism" table, with the plugin as the pin.
3. Update "CI results on this PR" with run 43929156339 (`2acab89e`) and run 43944637053 (`46c23a6b`): all five apps 0 of N and byte-identical in both the table and the self-check, with both runs green. Remove "The latest commit, `9f49058e`… still in progress".
4. Update "Changes after review" and the "Quality review" checklist. Add the round-3 changes: the plugin, the fail-closed self-check that also requires byte-identical scripts, the removed variation and re-run advice, the key-safety note, and the measured CI cost table. Tick "CI is green".
5. Replace "about 10 to 16 minutes" with the measured 13m14s to 16m43s per uncached build, about 41 to 50 minutes for the whole `build` job on a self-check PR. Point to the docs' steady-state section.
6. Mention the −10 to +37 B (mean +7) one-time shift from the code-derived debug ids against Sentry's own ids, as the docs do.

Once the body says this, the PR is ready to ship.
