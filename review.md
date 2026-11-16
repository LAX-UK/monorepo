Verdict: SHIP

Independent review of #1510 (CB-8F7), head 8679544b. Nothing here blocks merge. The findings below are small follow-ups.

## What was verified

- `pnpm --filter @auction/db exec vitest run src/scripts/backfill-collection-reminder-keys-args.test.ts src/scripts/backfill-payment-refund-args.test.ts`: 19/19 pass, including the pnpm end-to-end test of the refund runbook and resume commands. `biome check packages/db/src/scripts` is clean. `tsc --noEmit` for `packages/db` is clean after building the workspace dependencies.
- **The tests fail without the change.** Old logic (`argv.includes("--apply")`) behind the new `parseReminderBackfillArgs` export: 3 of the 5 reminder tests fail (unknown flags, repeated `--apply`, main rejects `--aply`). The refund source reverted to `main`: the new empty-value test fails (`got '--batch-size must be a whole number…'`). With all source changes reverted, the reminder test file can't even load.
- Edge cases on the reminder parser:

  | argv | result |
  |---|---|
  | `[]` | dry run |
  | `--apply` | apply |
  | `-- --apply` | apply |
  | `-- -- --apply` | apply |
  | `--apply --` | apply |
  | `--apply=true` | rejected: Unknown argument |
  | `foo --apply` | rejected |
  | `--apply foo` | rejected |
  | `-a` | rejected |
  | `--APPLY` | rejected |
  | `"--apply "` | rejected |
  | `""` | rejected |

- The real CLI: `pnpm -s db:backfill-collection-reminder-keys --aply` exits 1 before reading `DATABASE_URL`. The documented forms run through pnpm from the repo root (no args, `--apply`, `-- --apply`) all get past parsing and stop at `DATABASE_URL_OWNER required`, so valid invocations behave as before. The integration test still calls `main([])` and `main(["--apply"])`.
- Refund CLI: `--bogus` exits 1, as before. `--batch-size=`, `--lock-timeout=` and `--resume-after=` were already rejected and now say `needs a value`. Whitespace values (`--batch-size= `) still reach the old per-flag validation and are rejected.
- Runbook: the 5 s figure matches `LOCK_TIMEOUT_MS = 5000` (backfill-collection-reminder-keys.ts:27). The rollback-and-re-run description matches the batch transaction and the script header.
- SOLID/DRY: one parser (`backfill-cli-flags.ts`), parameterised by the allowed value flags, used by both scripts. No copy-paste.

## Findings

1. **The reminder CLI prints a full stack trace for a mistyped flag.** `packages/db/src/scripts/backfill-collection-reminder-keys.ts:133` calls `console.error(err)`, so `--aply` prints the message and then 7 stack frames. The refund CLI prints only the message (`backfill-payment-refund.ts:108`). The exit code is right (1), but the "clear error" goal is only half met.
   Fix: `console.error(err instanceof Error ? err.message : err);`. Unexpected DB errors still need a stack, so print it only for argument errors: throw a small `BackfillArgsError` from `collectFlags` and print `.message` only for that class.

2. **The refund CLI's usage hint got less informative.** `packages/db/src/scripts/backfill-cli-flags.ts:10` builds the hint as `--name=...`. Before, the refund error said `expected --apply, --batch-size=N, --lock-timeout=D, --resume-after=ID`. Now it says `--batch-size=..., --lock-timeout=..., --resume-after=...`. No test asserts the old text, but this is a user-visible change to the refund CLI, which the PR says is unchanged.
   Fix: take placeholders, e.g. `valueFlags: Readonly<Record<string, string>>`, and have refund pass `{ "batch-size": "N", "lock-timeout": "D", "resume-after": "ID" }`. Build the hint from those and the allowed names from `Object.keys`.

3. **The "before touching the database" test doesn't prove that.** `packages/db/src/scripts/backfill-collection-reminder-keys-args.test.ts:22`: with `DATABASE_URL` unset, the old code throws `DATABASE_URL_OWNER required`, so the test only shows that parsing runs before the env check. It would not catch a future reorder that parses after `createDb(url)`.
   Fix: stub the env (`vi.stubEnv("DATABASE_URL_OWNER", "postgres://invalid")`), `vi.mock("../client.js")`, and assert `createDb` was never called.

4. **The edge cases checked above have no tests.** The behaviour is correct, but none of these are pinned: `--apply=true` (only `--apply=1` is tested), `--apply foo` (a flag before a positional), `""`, and `--apply --`. Each is one line in the `it.each` list at `backfill-collection-reminder-keys-args.test.ts:13`. A `["--apply", "--"]` case belongs at line 9.

5. **Nit: `flagValue` is now a pointless wrapper.** `packages/db/src/scripts/backfill-payment-refund-args.ts:35` does nothing but `values.get(name)`. It predates this PR, but the PR already touches this block, so inline it.
