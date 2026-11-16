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
