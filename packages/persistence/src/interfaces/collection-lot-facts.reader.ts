import type { CollectionLotFacts } from "@auction/domain";
import type { LegalEntityKind } from "@auction/types";

/** A won lot as collection booking sees it: who bought it, where it is collected, and what stands in the way. */
export type CollectionLotRecord = {
  lotId: string;
  title: string;
  lotNumber: number | null;
  /** The account that bought the lot; `null` while it has no buyer. */
  buyerLegalEntityId: string | null;
  buyerAccountKind: LegalEntityKind | null;
  /** The person whose bid won. */
  winnerId: string | null;
  /** The venue the lot is collected from (its sale's venue); `null` when none is set. */
  venueId: string | null;
  facts: CollectionLotFacts;
};

/**
 * Reads, for each lot asked for, the facts collection eligibility is decided from. A lot that does
 * not exist, or was never won, is absent from the result.
 */
export interface ICollectionLotFactsReader {
  read(lotIds: readonly string[]): Promise<Map<string, CollectionLotRecord>>;
  /**
   * The ids of the lots an account bought that are collected from this place, in lot-number order,
   * for offering the rest of an account's works beside the ones asked about.
   */
  lotIdsForBuyer(legalEntityId: string, venueId: string, limit: number): Promise<string[]>;
}
