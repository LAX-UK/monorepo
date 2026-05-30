export type LotJobSchedulerPort = {
  rescheduleEnd(lotId: string, endTime: Date): Promise<void>;
  cancelLotJobs(lotId: string): Promise<void>;
};

export type BidPolicyConfig = {
  /** Extend lot end when a bid arrives within this window before close (ms). */
  antiSnipingWindowMs: number;
  /** Amount of time added to endTime on anti-snipe extension (ms). */
  antiSnipingExtensionMs: number;
  /** Safety cap for legacy iterative proxy rounds (direct settlement uses 0–1 rows). */
  maxProxyRounds: number;
};

export const DEFAULT_BID_POLICY: BidPolicyConfig = {
  antiSnipingWindowMs: 2 * 60 * 1000,
  antiSnipingExtensionMs: 30_000,
  maxProxyRounds: 100,
};
