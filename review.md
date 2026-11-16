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
