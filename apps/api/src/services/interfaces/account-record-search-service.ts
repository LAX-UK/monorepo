import type { AccountSearchGroup } from "@auction/domain";
import type { AccountSearchHits } from "@auction/persistence/interfaces";
import type { AccountSearchQuery } from "@auction/validators";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

/** One group's page of results. */
export type AccountSearchGroupResult<G extends AccountSearchGroup = AccountSearchGroup> = {
  [K in G]: {
    group: K;
    items: AccountSearchHits[K][];
    /** Where the next page starts, or `null` when this is the last. */
    nextOffset: number | null;
  };
}[G];

export type AccountSearchResult = {
  /** Every group this member may search, in display order, whatever the text. */
  searchable: AccountSearchGroup[];
  /** The groups searched; empty when the text is too short to search. */
  groups: AccountSearchGroupResult[];
};

export type AccountSearchError = {
  code: "insufficient_entity_role";
  status: 403;
  message: string;
};

/**
 * Finds records inside the acting account: consignments, purchases, bids, works, invoices and
 * people, each only when the member can open that list, and narrowed as the list is.
 */
export interface IAccountRecordSearchService {
  search(
    actor: OrganisationMemberActor,
    query: AccountSearchQuery,
  ): Promise<Result<AccountSearchResult, AccountSearchError>>;
}
