import {
  DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE,
  DEFAULT_PAYMENT_REFUND_BACKFILL_LOCK_TIMEOUT_MS,
} from "../payment-refund-backfill.js";
import { collectFlags } from "./backfill-cli-flags.js";

/** Postgres' maximum for lock_timeout, in milliseconds. */
export const MAX_LOCK_TIMEOUT_MS = 2_147_483_647;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `500ms`, `5s`, `1m` or a bare number of milliseconds; 0 means no timeout. */
export function parseDuration(text: string): number {
  const match = /^(\d+)(ms|s|m)?$/.exec(text.trim());
  if (!match) throw new Error(`Not a duration: ${text} (use 500ms, 5s, 1m or milliseconds)`);
  const unit = match[2] ?? "ms";
  const ms = Number(match[1]) * (unit === "m" ? 60_000 : unit === "s" ? 1000 : 1);
  if (!Number.isSafeInteger(ms) || ms > MAX_LOCK_TIMEOUT_MS) {
    throw new Error(
      `Lock timeout too large: ${text} (at most ${MAX_LOCK_TIMEOUT_MS} ms; 0 means no timeout)`,
    );
  }
  return ms;
}

export type BackfillArgs = {
  apply: boolean;
  batchSize: number;
  lockTimeoutMs: number;
  resumeAfter: string | null;
};

const VALUE_FLAGS = ["batch-size", "lock-timeout", "resume-after"] as const;

function flagValue(values: Map<string, string>, name: string): string | undefined {
  return values.get(name);
}

/** Validates every flag; throws with a clear message on the first bad one. Pure: no I/O. */
export function parseBackfillArgs(argv: readonly string[]): BackfillArgs {
  const { apply, values } = collectFlags(argv, VALUE_FLAGS);

  const batchFlag = flagValue(values, "batch-size");
  let batchSize = DEFAULT_PAYMENT_REFUND_BACKFILL_BATCH_SIZE;
  if (batchFlag !== undefined) {
    batchSize = /^\d+$/.test(batchFlag) ? Number(batchFlag) : Number.NaN;
    if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
      throw new Error(`--batch-size must be a whole number above zero, got "${batchFlag}"`);
    }
  }

  const timeoutFlag = flagValue(values, "lock-timeout");
  const lockTimeoutMs =
    timeoutFlag !== undefined
      ? parseDuration(timeoutFlag)
      : DEFAULT_PAYMENT_REFUND_BACKFILL_LOCK_TIMEOUT_MS;

  const resumeFlag = flagValue(values, "resume-after");
  if (resumeFlag !== undefined && !UUID.test(resumeFlag)) {
    throw new Error(`--resume-after must be a payment id (uuid), got "${resumeFlag}"`);
  }

  return { apply, batchSize, lockTimeoutMs, resumeAfter: resumeFlag ?? null };
}

/** The command the runbook gives for a run with `--apply`, from the repository root. */
export const APPLY_COMMAND = "pnpm --filter @auction/db db:backfill-payment-refund -- --apply";

/**
 * The command printed after a lock timeout: the runbook's `--apply` command with the batch size
 * and lock timeout in effect, and the cursor when a batch was committed. It parses back to the
 * same arguments (see the test).
 */
export function resumeCommand(
  args: Pick<BackfillArgs, "batchSize" | "lockTimeoutMs">,
  resumeAfter: string | null,
): string {
  const cursor = resumeAfter ? ` --resume-after=${resumeAfter}` : "";
  return `${APPLY_COMMAND} --batch-size=${args.batchSize} --lock-timeout=${args.lockTimeoutMs}ms${cursor}`;
}
