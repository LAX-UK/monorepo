/** A register entry that says "in a LAX Bid sale" while its lot is not live. */
export type RegisterLotMismatch = {
  registerId: string;
  stockCode: string;
  title: string;
  /** The lot the register points at; null when it points at none or the lot is gone. */
  lotId: string | null;
  /** The lot's status when it exists and is not deleted. */
  lotStatus: string | null;
  /** When the register entry last changed. */
  changedAt: Date;
};

/** Finds where the register and LAX Bid disagree. Reads only: nothing is changed. */
export interface IRegisterLotIntegrityReader {
  /**
   * Entries recorded as in a LAX Bid sale whose lot is not published, active, or ended with a
   * winner (the buyer has yet to pay). Oldest first.
   */
  listBidSaleMismatches(limit: number): Promise<RegisterLotMismatch[]>;
}

/** An original that is live but has no register record. */
export type UnlinkedOriginal = {
  product: "bid" | "lax_art";
  id: string;
  title: string;
  artistName: string | null;
  /** Where it is in its product, in words ("Scheduled", "Live", "Published"). */
  state: string;
};

export type UnlinkedOriginalsReport = {
  items: UnlinkedOriginal[];
  counts: { bid: number; laxArt: number };
};

/** Live originals, on lax.art and in LAX Bid, with no register link. */
export interface IUnlinkedOriginalsReader {
  listLiveUnlinkedOriginals(limit: number): Promise<UnlinkedOriginalsReport>;
}

/** The staff switch that stops a lot with no register link from being published. */
export interface IBidPublishSettings {
  blockUnlinkedPublish(): Promise<boolean>;
  setBlockUnlinkedPublish(enabled: boolean, actorUserId: string): Promise<void>;
}
