import type {
  ArtworkRegisterEntry,
  ReopenGallerySaleRefusal,
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
  /** "Dealt with", only for an artwork the register shows as sold in the gallery. */
  markDealtWith(input: { id: string; actor: string; now: Date }): Promise<
    | { ok: true; item: SoldAttentionRecord }
    | { ok: false; reason: "not_found" | "not_open" | "not_sold_in_gallery" }
  >;
}

/** Takes back a sale made in the gallery; the register checks the rules under its row lock. */
export interface GallerySaleReopener {
  reopenGallerySale(input: {
    registerId: string;
    reason: string;
    actor: string;
    now: Date;
  }): Promise<
    | { ok: true; entry: ArtworkRegisterEntry; reason: string }
    | { ok: false; refusal: ReopenGallerySaleRefusal | "not_found" | "version_conflict" }
  >;
}

/** One row in LAX Admin's audit log. */
export type SoldAttentionAudit = (row: {
  actorSubjectId: string;
  capability: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson?: Record<string, unknown>;
  afterJson?: Record<string, unknown>;
}) => Promise<void>;

/** The lot numbers LAX Bid gave its lots, for the words "lot 12". */
export interface LotNumberReader {
  numbersFor(lotIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
