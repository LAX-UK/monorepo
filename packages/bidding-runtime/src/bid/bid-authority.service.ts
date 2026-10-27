import { type BidAuthorityDecision, decideBidAuthority, parseMoneyCap } from "@auction/domain";
import type {
  IBidMembershipReader,
  IBuyerAgentAuthorisationReader,
} from "@auction/persistence/interfaces";

export type BidAuthorityQuery = {
  userId: string;
  legalEntityId: string;
  /** The sale being bid in; `null` when there is none (only all-sales authorisations count). */
  saleId: string | null;
};

/**
 * Decides whether a person may bid for a legal entity. Every bidding channel (online and
 * auto-bids, absentee, telephone, saleroom check-in and paddle bids) asks this one service, so
 * the rule lives in one place.
 */
export interface IBidAuthority {
  resolve(query: BidAuthorityQuery): Promise<BidAuthorityDecision>;
}

export class BidAuthorityService implements IBidAuthority {
  constructor(
    private readonly membershipReader: IBidMembershipReader,
    private readonly authorisationReader: IBuyerAgentAuthorisationReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async resolve(query: BidAuthorityQuery): Promise<BidAuthorityDecision> {
    const role = await this.membershipReader.findActiveMemberRole(
      query.userId,
      query.legalEntityId,
    );
    const first = decideBidAuthority({ role, grants: [], saleId: query.saleId });
    if (first.allowed || first.reason !== "authorisation_required") return first;

    const rows = await this.authorisationReader.findActiveAuthorisations({
      legalEntityId: query.legalEntityId,
      userId: query.userId,
      saleId: query.saleId,
      now: this.now(),
    });
    return decideBidAuthority({
      role,
      grants: rows.map((row) => ({ saleId: row.saleId, bidLimit: parseMoneyCap(row.bidLimit) })),
      saleId: query.saleId,
    });
  }
}
