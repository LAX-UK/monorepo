import {
  DEFAULT_ANTI_SNIPING_EXTENSION_MS,
  DEFAULT_ANTI_SNIPING_WINDOW_MS,
} from "@auction/validators";

export type LotJobSchedulerPort = {
  rescheduleEnd(lotId: string, endTime: Date): Promise<void>;
  cancelLotJobs(lotId: string): Promise<void>;
};

export type BidPolicyConfig = {
  antiSnipingWindowMs: number;
  antiSnipingExtensionMs: number;
};

export const DEFAULT_BID_POLICY: BidPolicyConfig = {
  antiSnipingWindowMs: DEFAULT_ANTI_SNIPING_WINDOW_MS,
  antiSnipingExtensionMs: DEFAULT_ANTI_SNIPING_EXTENSION_MS,
};
