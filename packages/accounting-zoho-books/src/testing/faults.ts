/**
 * Things a provider can do that the contract must survive. Both the simulated Books and the
 * in-memory fake can be told to do each of them to the next write (`rate_limited` lasts until cleared).
 * - `timeout_after_commit`: the document is made, but the caller never hears (the answer is `unknown`).
 * - `rate_limited`: refused before anything happens.
 * - `locked_period`: refused because the date is in a locked accounting period.
 * - `totals_drift`: the document is made but the provider's total is a penny off ours.
 */
export const FAULTS = [
  "timeout_after_commit",
  "rate_limited",
  "locked_period",
  "totals_drift",
] as const;
export type Fault = (typeof FAULTS)[number];

export interface FaultInjector {
  inject(fault: Fault): void;
  clear(): void;
}

/** The queue both stand-ins use: one-shot faults are taken by the next write; rate limiting stays. */
export class FaultQueue implements FaultInjector {
  private queue: Fault[] = [];
  private limited = false;

  inject(fault: Fault): void {
    if (fault === "rate_limited") this.limited = true;
    else this.queue.push(fault);
  }

  clear(): void {
    this.queue = [];
    this.limited = false;
  }

  /** The fault that applies to the write now happening, if any. */
  take(): Fault | undefined {
    if (this.limited) return "rate_limited";
    return this.queue.shift();
  }
}
