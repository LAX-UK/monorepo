export type FailedJobReplayRow = {
  id: string;
  originalQueue: string;
  originalJobName: string | null;
  payloadJson: string | null;
  replayedAt: Date | null;
};

export interface IFailedJobRepository {
  findById(id: string): Promise<FailedJobReplayRow | null>;
  /** Atomically mark replayed; returns null when already replayed or missing. */
  claimReplay(id: string, replayedBy: string): Promise<FailedJobReplayRow | null>;
  clearReplayClaim(id: string): Promise<void>;
}
