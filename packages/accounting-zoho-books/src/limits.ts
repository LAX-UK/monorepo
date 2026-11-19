import type { CallBudget, RateWindow, RefreshLock } from "./ports.js";

/**
 * The limits every process calling one Books organisation must share: the daily budget, the
 * per-organisation rate window and the token refresh lock. Production passes all three (the Redis
 * ones in `@auction/finance-runtime`).
 */
export interface ZohoBooksSharedLimits {
  readonly budget: CallBudget;
  readonly rateWindow: RateWindow;
  readonly refreshLock: RefreshLock;
}

/** Marks a client that keeps its limits in this process. Only `inProcessZohoBooksLimits` sets it. */
export const IN_PROCESS_LIMITS: unique symbol = Symbol("zoho_books.in_process_limits");

/**
 * Limits kept in this process's memory (per replica), for tests and single-process tools. Any of
 * the three may still be given; the rest are the in-process defaults.
 */
export interface ZohoBooksInProcessLimits extends Partial<ZohoBooksSharedLimits> {
  readonly inProcessLimits: typeof IN_PROCESS_LIMITS;
}

/**
 * Opts a client into in-process limits. Exported from `./testing` only, so a client built outside
 * tests without the shared limits does not compile.
 */
export function inProcessZohoBooksLimits(
  limits: Partial<ZohoBooksSharedLimits> = {},
): ZohoBooksInProcessLimits {
  return { ...limits, inProcessLimits: IN_PROCESS_LIMITS };
}
