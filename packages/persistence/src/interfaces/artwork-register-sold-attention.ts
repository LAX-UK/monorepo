import type {
  ArtworkRegisterEntry,
  MoneyPauseReader,
  SoldWhileLivePlace,
  SoldWhileLiveResolution,
  SoldWhileLiveStatus,
} from "@auction/artwork-register-contracts";

/** One "Zoho says Sold, but this artwork is still for sale" item. */
export type SoldAttentionRecord = {
  id: string;
  registerId: string;
  zohoProductId: string;
  zohoStatus: SoldWhileLiveStatus;
  place: SoldWhileLivePlace;
  placeRefId: string | null;
  markedAt: Date;
  /** `open` pauses new money; `overridden` is "it is not sold", kept so it is not raised again. */
  status: "open" | "overridden" | "resolved";
  resolution: SoldWhileLiveResolution | "replaced" | "staff_override" | null;
  resolvedBy: string | null;
  overrideReason: string | null;
  raisedAt: Date;
  resolvedAt: Date | null;
};

export type SoldAttentionItem = { item: SoldAttentionRecord; entry: ArtworkRegisterEntry };

export type RaiseSoldAttentionInput = {
  registerId: string;
  zohoProductId: string;
  zohoStatus: SoldWhileLiveStatus;
  place: SoldWhileLivePlace;
  placeRefId: string | null;
  markedAt: Date;
  now: Date;
};

export type ResolveSoldAttentionInput = {
  id: string;
  resolution: SoldWhileLiveResolution | "replaced";
  now: Date;
};

export type OverrideSoldAttentionResult =
  | { ok: true; item: SoldAttentionRecord }
  | { ok: false; reason: "not_found" | "not_open" };

/**
 * The items, with their history. Raising, resolving and overriding each write the item and the
 * artwork's history entry together, so the record never shows one without the other.
 */
export interface ISoldAttentionStore extends MoneyPauseReader {
  /** The item that is open or kept by an override for this artwork, or null. */
  findLive(registerId: string): Promise<SoldAttentionRecord | null>;
  /** Raises the item; a second call for the same artwork and status changes nothing. */
  raise(input: RaiseSoldAttentionInput): Promise<{ raised: boolean }>;
  /** Closes an item the situation has ended for. Safe to repeat. */
  resolve(input: ResolveSoldAttentionInput): Promise<boolean>;
  /** "It is not sold": clears the pause and keeps the reason in the artwork's history. */
  override(input: {
    id: string;
    reason: string;
    /** `staff:<user id>`. */
    actor: string;
    now: Date;
  }): Promise<OverrideSoldAttentionResult>;
  /** Open items, oldest first, with their artworks. */
  listOpen(limit: number): Promise<SoldAttentionItem[]>;
  countOpen(): Promise<number>;
  /** Every item still held (open or overridden), for the nightly check that closes finished ones. */
  listLiveRegisterIds(limit: number): Promise<string[]>;
}
