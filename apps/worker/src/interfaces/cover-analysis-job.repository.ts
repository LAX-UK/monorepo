import type { CoverAnalysis, SaleCoverSlot, SaleCoverSlotName } from "@auction/types";

/** A stored cover slot whose picture, crop and text side have not been measured yet. */
export type PendingCoverSlot = {
  saleId: string;
  name: SaleCoverSlotName;
  slot: SaleCoverSlot;
};

export type CoverAnalysisOutcome =
  | { status: "ready"; analysis: CoverAnalysis }
  | { status: "failed" };

export interface ICoverAnalysisJobRepository {
  /** Slots with no analysis for their fingerprint, newest sale first, one per fingerprint. */
  listPending(limit: number): Promise<PendingCoverSlot[]>;
  /** Keeps the outcome for a fingerprint, replacing an earlier one. */
  save(hash: string, outcome: CoverAnalysisOutcome): Promise<void>;
}
