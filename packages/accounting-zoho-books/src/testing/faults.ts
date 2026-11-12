/**
 * Things a provider can do that the contract must survive. Both the simulated Books and the
 * in-memory fake can be told to do each of them. Write faults apply to the next create
 * (`rate_limited` lasts until cleared); lookup faults apply to the next search by reference.
 * - `timeout_after_commit`: the document is made, but the caller never hears (the answer is `unknown`).
 * - `rate_limited`: refused before anything happens.
 * - `locked_period`: refused because the date is in a locked accounting period.
 * - `totals_drift`: the document is made but the provider's total is a penny off ours.
 * - `lookup_unavailable`: the search answers with something unreadable.
 * - `lookup_ambiguous`: the search finds two documents with the reference.
 */
export const WRITE_FAULTS = [
  "timeout_after_commit",
  "rate_limited",
  "locked_period",
  "totals_drift",
] as const;
export const LOOKUP_FAULTS = ["lookup_unavailable", "lookup_ambiguous"] as const;
export const FAULTS = [...WRITE_FAULTS, ...LOOKUP_FAULTS] as const;
export type WriteFault = (typeof WRITE_FAULTS)[number];
export type LookupFault = (typeof LOOKUP_FAULTS)[number];
export type Fault = WriteFault | LookupFault;

export interface FaultInjector {
  inject(fault: Fault): void;
  clear(): void;
}

const isLookupFault = (fault: Fault): fault is LookupFault =>
  (LOOKUP_FAULTS as readonly string[]).includes(fault);

/** The queue both stand-ins use. */
export class FaultQueue implements FaultInjector {
  private writes: WriteFault[] = [];
  private lookups: LookupFault[] = [];
  private limited = false;

  inject(fault: Fault): void {
    if (fault === "rate_limited") this.limited = true;
    else if (isLookupFault(fault)) this.lookups.push(fault);
    else this.writes.push(fault);
  }

  clear(): void {
    this.writes = [];
    this.lookups = [];
    this.limited = false;
  }

  /** The fault that applies to the write now happening, if any. */
  take(): WriteFault | undefined {
    if (this.limited) return "rate_limited";
    return this.writes.shift();
  }

  /** The fault that applies to the search now happening, if any. */
  takeLookup(): LookupFault | undefined {
    return this.lookups.shift();
  }
}
