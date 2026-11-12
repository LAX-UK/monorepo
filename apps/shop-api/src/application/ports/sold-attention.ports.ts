import type {
  ArtworkRegisterEntry,
  SoldWhileLivePlace,
  SoldWhileLiveStatus,
} from "@auction/artwork-register-contracts";

/** One item as the review service reads it; the register's store implements this. */
export type SoldAttentionRecord = {
  id: string;
  registerId: string;
  zohoProductId: string;
  zohoStatus: SoldWhileLiveStatus;
  place: SoldWhileLivePlace;
  placeRefId: string | null;
  markedAt: Date;
  raisedAt: Date;
};

export interface SoldAttentionQueue {
  listOpen(limit: number): Promise<{ item: SoldAttentionRecord; entry: ArtworkRegisterEntry }[]>;
  override(input: { id: string; reason: string; actor: string; now: Date }): Promise<
    { ok: true; item: SoldAttentionRecord } | { ok: false; reason: "not_found" | "not_open" }
  >;
}

/** The lot numbers LAX Bid gave its lots, for the words "lot 12". */
export interface LotNumberReader {
  numbersFor(lotIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
