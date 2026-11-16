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
