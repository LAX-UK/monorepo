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

/** Where the next page of live items starts: after this one, by when it was raised, then id. */
export type SoldAttentionLiveCursor = { raisedAt: Date; id: string };

export type SoldAttentionLiveRef = { id: string; registerId: string; raisedAt: Date };

export type OverrideSoldAttentionResult =
  | { ok: true; item: SoldAttentionRecord }
  | { ok: false; reason: "not_found" | "not_open" };

/**
 * The items, with their history. Raising, resolving and overriding each write the item and the
 * artwork's history entry together, so the record never shows one without the other.
 */
export interface ISoldAttentionStore extends MoneyPauseReader {
  /** The item that is open or kept by an override for this artwork (the newest if two), or null. */
  findLive(registerId: string): Promise<SoldAttentionRecord | null>;
  /** Raises the item; a second call for the same artwork and status changes nothing. */
  raise(input: RaiseSoldAttentionInput): Promise<{ raised: boolean }>;
  /**
   * Closes the live item as replaced and raises the new one in one transaction, so there is no
   * moment with nothing open (and no pause) between the two. False when the item was no longer live.
   */
  replace(input: { id: string; now: Date; raise: RaiseSoldAttentionInput }): Promise<boolean>;
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
  /**
   * Items still held (open or overridden), oldest first, for the nightly check that closes finished
   * ones. Pass the last item's cursor to read the next page; a page shorter than `limit` is the last.
   */
  listLive(limit: number, after?: SoldAttentionLiveCursor): Promise<SoldAttentionLiveRef[]>;
}
