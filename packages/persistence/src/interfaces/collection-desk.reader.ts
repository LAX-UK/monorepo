/** What the collections desk shows about a lot beside its booking. */
export type CollectionDeskLot = {
  lotId: string;
  title: string;
  lotNumber: number | null;
  /** The first picture of the work, or `null`. */
  image: string | null;
  /** The lot's fulfilment status; `null` when it has no fulfilment record. */
  fulfilmentStatus: string | null;
};

/** Reads, in one go, what the desk needs to draw a day of bookings. */
export interface ICollectionDeskReader {
  /** The lots asked for that exist; a lot that does not is absent. */
  lots(lotIds: readonly string[]): Promise<Map<string, CollectionDeskLot>>;
  /** The names of the buying accounts, keyed by account id. */
  accountNames(accountIds: readonly string[]): Promise<Map<string, string>>;
}
