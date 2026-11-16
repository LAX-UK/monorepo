Verdict: FIX FIRST

# Review of PR #1509: "Worker: make the critical notification wake test wait on real readiness"

Reviewed head `7f0c415d` against base `a811c33b` (main). This was a review only; the PR branch was not changed. The PR changes one file: `apps/worker/src/notifications/notification-outbox-wake.integration.test.ts` (+135/−61). Line numbers below are from the PR head unless they say `main:`.

## Blocking

### B1. The merge-queue failure is a different failure, and the PR neither cites nor explains it

The task names two CI failures. The PR body explains only one of them.

| Run | Job | Duration | Logged error | Logged delivery |
|---|---|---|---|---|
| PR #1503, run 43927432281 | 133511730810 | 4138 ms | `TypeError: Cannot read properties of undefined (reading 'name')` at `main:…integration.test.ts:158:11` / `156:35` | `outbid notice delivered 1617ms after commit` |
| merge-queue run 43928262155 (dropped #1505) | 133513984682 | 6369 ms | `AssertionError: expected 3810 to be less than 3000` at `main:…integration.test.ts:151:23` | `outbid notice delivered 3810ms after commit` |

- The PR's root cause is proven for #1503, and I confirmed it in the log: delivery was on time, and the crash came from the sweep check's `queue.getJobs(["active","completed","failed"])` returning an `undefined` entry (`main:155-158`).
- The merge-queue job fails differently. The *latency* assertion fails (3810 ms against a 3000 ms budget) before the sweep check ever runs. This is the job that dropped #1505. The PR body never mentions run 43928262155 or job 133513984682. It says "An earlier run on the same PR was also red" without a run id. It also states that the latency check passed, which is true only of the #1503 job.
- The PR's "minute sweep in the window" point is offered as a cause, but no CI log shows it. It also cannot produce the 3810 ms result without something else going wrong:
  - The sweep repeats with `every: 60000` (`apps/worker/src/workers/register-notification-outbox-workers.ts:122`). BullMQ 5.77.6 aligns it to minute boundaries (`node_modules/bullmq/dist/cjs/classes/repeat.js:184`).
  - The claim guard is 1000 ms (`created_at < now-1s`, `drizzle-notification-outbox.repository.ts:115`).
  - A sweep that starts after commit+1.0 s would claim and deliver the row itself, in under ~1.5 s. That would trip the sweep check, not the latency check.
  - A sweep that starts earlier holds the global-concurrency slot. To push delivery to 3.8 s it would have to run for about 2.3 s or more. A single `processBatch(50)` is milliseconds when nothing else is pending.
  - So something made the drain path itself slow, or kept the row out of the signal drains, for about 2.3 s. The PR does not identify what.
- The PR keeps the 3000 ms latency assertion unchanged, which is correct (see Verified). The consequence is that if the 3810 ms cause is not a sweep, the merge-queue flake is still there after this PR.

**Hypothesis to check (not proven):** the worker suite runs its test files in parallel against one shared `auction_ci` database. `apps/worker/vitest.config.ts` has no `fileParallelism: false`.
- `claim()` takes *any* pending row, oldest first (`drizzle-notification-outbox.repository.ts:115,128`). Every drain in this test therefore also processes outbox rows staged by other files that are running at the same time. `src/reoffer/reoffer-clock.integration.test.ts` stages notices into `notification_outbox`.
- If older rows are waiting, the settle drain spends its time on them first, under CI load. It also means this test's drains can send other files' rows.
- That would explain a slow delivery that no sweep check catches. The new test does nothing about it.

**Needed before merging:**
1. Explain the 3810 ms merge-queue failure with evidence from job 133513984682, or from a reproduction under the full parallel suite.
2. Show that the fix covers it, or fix it. For example: isolate the test's outbox rows or drains from other files, or make the integration files run serially.
3. List both failing runs in the PR body.

## Non-blocking

- **N1. "By its bucketed job id" is not exact.** The "once" wait accepts any completed settle job with bucket `>= followUpBucket` (lines 220-230), not this signal's own follow-up. A settle job raised by another file's NOTIFY on the shared channel could satisfy it first. The row is already `sent`, so this cannot make the test pass wrongly. But the PR body's "by its bucketed job id" overstates what the code does. It still waits on a real event, which is stronger than main's blind `sleep(2_000)` (`main:171`).
- **N2. The "through the signal" window is not bounded by the sweep clearance.** The check covers every job active from staging until the follow-up completes (line 248). Sweep clearance only guarantees about 6.5 s (`SWEEP_CLEARANCE_MS`, line 42). The follow-up wait can run up to `CI_DEADLINE_MS` (20 s, line 40). On a very slow runner, a sweep could start inside that wait and fail line 248, although only in a run that would also be near the latency limit. A comment, or bounding the follow-up wait by the clearance, would make this explicit.
- **N3. The worst-case test timeout is long.** It is about 126 s (line 250), and `clearOfSweeps` can wait up to about 86 s (line 111). That is acceptable for an integration test, but the PR body's "≤ ~70 s" leaves out the CI_DEADLINE slack.

## Verified

- **No blind sleeps remain.** The `sleep` helper and both sleeps on main (`main:128` 2.5 s, `main:171` 2 s) are gone. Readiness now waits on real signals: QueueEvents subscribed before the worker exists (line 125), the `notification_outbox_wake_listening` log (line 166), *and* a completed connect-wake settle drain (lines 168-172).
- **No fixed timeout was raised as the fix.** The `vi.waitFor` deadlines grew from 5 s to 20 s (lines 174, 212, 230). They are poll limits only. Latency is still computed from `notification.createdAt - committedAt`.
- **Line-by-line comparison of assertions (property not weakened):**
  - Exactly one notification for the user: `main:144` → `:207` (unchanged).
  - Latency `< DELIVERY_BUDGET_MS` (3000): `main:151` → `:216` (unchanged).
  - No sweep between commit and delivery: `main:155-162` (sweep `processedOn` in the window; crashed on `undefined`) → `:246-248` (no non-wake job *active* at all from staging until the follow-up completed, plus sweep clearance before staging at lines 98-112). This is stronger and fixes the #1503 crash. The `undefined` filter at line 104 is commented.
  - Outbox row `sent`: `main:168` → `:242` (unchanged).
  - Still exactly one notification after the follow-up: `main:171-176` (after `sleep(2000)`) → `:221-236` (after the follow-up's completed event). This is stronger, with the caveat in N1.
  - New check: at least one job ran (line 247).
- **No production code changed.** Only the test file is in the diff.
- **No new skips.** Only the existing `describe.skipIf(!databaseUrl || !redisUrl)` guards remain (lines 61, 283, 374). CI skip counts are unchanged: 462 skipped / 2637 tests on both the failed main-based run and the PR run.
- **CI on the PR is green.** Run 43934246810: `ci-result` success. In `test` job 133534880746, the target test passed with `outbid notice delivered 1580ms after commit`, and the suite reported 265 files passed / 2175 tests passed.
- **Local stability** (Postgres 16 + Redis 7, `auction_ci` migrated and `db:roles` applied, as in CI):
  - Target test alone (`-t "within seconds, once, through the signal"`): 25/25 pass, delivery 1548–1602 ms. Runs 4 and 15 waited out a pending sweep (2.9 s and 5.6 s test time), so the clearance path ran.
  - Full worker suite (`vitest run`, all files in parallel): 3/3 pass, target delivery 1560 / 1596 / 1586 ms, 2175 passed / 462 skipped each time.
  - The 3810 ms merge-queue failure was **not** reproduced locally. These runs do not show it is fixed.
- **Typecheck and lint are clean.** `tsc --noEmit` on the worker passed, and `biome check` on the file was clean.
- **PR body:** no AI footer or generated-by line. It is accurate about the #1503 failure. It is incomplete or inaccurate about the merge-queue failure (B1) and slightly overstated in N1.

## Final recheck

Rechecked head `de19803b` (2 commits on base `a811c33b`) after the round-2 fixer. The PR branch was not changed.

**Summary:** the code is ready. The test is now deterministic against both observed failures, and repeated runs are clean. One blocking item is still open, and it is in the PR description only: B1.3. The description still lists only the #1503 run and calls the change "test only". It does not mention the merge-queue failure or the new `vitest.config.ts` project split. Once the description is updated, this can ship. No code change is needed.

### What changed in `de19803b`

- `apps/worker/vitest.config.ts` now defines two vitest projects:
  - `worker`: every `src/**/*.test.ts` file except the wake test.
  - `worker-realtime`: only `notification-outbox-wake.integration.test.ts`, with `sequence: { groupOrder: 1 }`.
- The test file:
  - waits for the follow-up drain by exact job id;
  - bounds that wait by the sweep clearance;
  - includes `active` jobs in the sweep scan;
  - measures the clearance from the check that passed;
  - recomputes the test timeout.

### Findings, one by one

| Finding | Status | Evidence |
|---|---|---|
| #1503 crash (`undefined` entry from `queue.getJobs`) | **Fixed** | `undefined` entries are filtered before use (`clearOfSweeps`, with a comment). The post-delivery sweep check no longer calls `getJobs`. It reads the `QueueEvents` stream recorded since staging (`ran = events.slice(eventsBefore)…`). No path in the test can dereference a removed job. |
| Merge-queue failure (`expected 3810 to be less than 3000`, run 43928262155 / job 133513984682) | **Fixed (cause isolated, budget unchanged)** | I confirmed this in the job log: `outbid notice delivered 3810ms after commit` is next to `bid-collection-anonymisation.integration.test.ts (10 tests) 4150ms`. That same file took 275 ms in this PR's CI run. So another file running in parallel on the shared `auction_ci` / Redis stalled at the same moment. The fix is isolation in time: the wake test is in a later vitest group. In vitest 3.2.6 (`node_modules/vitest/dist/chunks/coverage.DfSpMS-b.js:3391-3406`), specs are bucketed by `sequence.groupOrder` and the groups run one after another, each awaited before the next starts. So no other worker file is running while the test measures. CI `test` runs packages with `turbo --concurrency=1`, and the api/web/shop-api suites run in separate jobs with their own services. So nothing else shares the database during the measurement. The queue was already isolated by a per-run Redis `prefix`. |
| B1.1: explain the 3810 ms failure | **Fixed** | This is in the commit message and the `vitest.config.ts` comment: database/Redis contention from a file running beside the test, and not a sweep. One small inaccuracy: the commit says "no other file stages … notification_outbox rows". In fact `reoffer-clock.integration.test.ts` and `email-outbox-erasure.integration.test.ts` do stage rows. But neither one claims or drains rows, both delete their rows in `afterAll`, and both now finish before the wake test starts. So the claim-oldest-first hypothesis from round 1 cannot reach the wake test any more. |
| B1.2: show the fix covers it, or fix it | **Fixed** | See the row above. Isolating the test is the approach this review asked for. |
| B1.3: list both failing runs in the PR body | **Not fixed** | The PR body still names only run 43927432281 / job 133511730810. It still says "Fix (test only…)", omits the `vitest.config.ts` project split, and still says the follow-up is matched "by its bucketed job id". Run 43928262155 / job 133513984682 appears only in the commit message and the config comment. |
| N1: "once" accepted any later settle job | **Fixed** | The test now waits for `…-settle-<signal bucket + WAKE_SETTLE_DELAY_MS/WAKE_BUCKET_MS>`, which is this signal's own follow-up, by exact id. The divisibility of the two constants is asserted. |
| N2: follow-up wait not bounded by sweep clearance | **Fixed** | The wait timeout is `clearUntil - Date.now()`, where `clearUntil` is the passing clearance check + `SWEEP_CLEARANCE_MS`. The "no sweep ran" window is therefore covered by construction. |
| N3: test timeout / "≤ ~70 s" | **Fixed in code** | The timeout is `CLEAR_OF_SWEEPS_TIMEOUT_MS + CI_DEADLINE_MS + SWEEP_CLEARANCE_MS`, which is the real worst case. The PR body still says "≤ ~70 s". That is a wording issue, and B1.3's body edit covers it. |

### Not loosened, nothing weakened

- The latency assertion is still `latencyMs < DELIVERY_BUDGET_MS` with `DELIVERY_BUDGET_MS = 3_000`, measured from commit to `notification.createdAt`.
- The diff against base touches only `apps/worker/vitest.config.ts` and the test file. There is no production code in it.
- There are no new skips. Suite totals are unchanged at 2175 passed / 462 skipped (2637), both locally and in CI.
- `tsc --noEmit` (worker) passes. `biome check` on both changed files is clean.

### Repeated runs (local Postgres 16 + Redis 7, `auction_ci` migrated and `db:roles` applied, CI env vars)

| Mode | Runs | Passed | Target delivery (ms) |
|---|---|---|---|
| Wake test file alone (`vitest run <file>`, 6 tests) | 20 | **20/20** | 1550–1595 |
| Full worker suite (`vitest run`, both projects, `worker` files in parallel, then `worker-realtime`) | 5 | **5/5** (2175 passed / 462 skipped each) | 1558–1590 |
| Stress: wake file in its own process, started at the same time as a separate `vitest run --project worker` over the other 41 worker integration files (the old contention, which the project split now prevents) | 5 | **5/5** for the wake test | 1577–1600 |

- In every full-suite run, the `worker-realtime` results print after every `worker` result. That matches the group ordering in the vitest source.
- Stress-run caveat: my harness did not wait for each background "others" process to finish, so up to three copies of the other-files batch overlapped. In 2 of those 5 runs, `src/finance/accounting/shop-history-books.integration.test.ts` failed 2 tests. That was caused by overlapping copies of the same file on one database, not by this PR. The wake test passed in all 5.
- PR CI at `de19803b` (run 43945409717): `ci-result` success. In `test` job 133574044773, `worker-realtime` ran `notification-outbox-wake.integration.test.ts` (6 tests) with `outbid notice delivered 1573ms after commit`.

### Remaining before merge

1. Update the PR description:
   - list run 43928262155 / job 133513984682 and its cause (contention with `bid-collection-anonymisation` on the shared DB: 4150 ms against 275 ms normally);
   - describe the `vitest.config.ts` `worker-realtime` project with `groupOrder: 1`;
   - drop "test only" and "by its bucketed job id";
   - fix the "≤ ~70 s" wait estimate.

No code change is needed.
