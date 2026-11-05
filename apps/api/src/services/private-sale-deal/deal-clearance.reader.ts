import type {
  DealClearancePort,
  DealClearanceSnapshot,
  DealPartyRef,
  PartyClearance,
} from "@auction/domain";
import type {
  IAmlHoldStore,
  IKycRepository,
  IPrivateSaleDealFinanceStore,
  ISourceOfFundsRepository,
  IWatchlistScreeningReader,
} from "@auction/persistence/interfaces";
import type { PartyAmlStatus, PartyKycStatus, SourceOfFundsStatus } from "@auction/types";

const DAY_MS = 86_400_000;

export type DealClearanceDeps = {
  kyc: Pick<IKycRepository, "getUserKycState">;
  amlHolds: Pick<IAmlHoldStore, "getHold">;
  screenings: Pick<IWatchlistScreeningReader, "findLatestByUserId">;
  sourceOfFunds: Pick<
    ISourceOfFundsRepository,
    | "findLatestApprovedForUser"
    | "findPendingForUser"
    | "findLatestForUser"
    | "sumActiveBuyerSettlementPence"
  >;
  deals: Pick<IPrivateSaleDealFinanceStore, "sumOtherOpenExposureMinor">;
  /** How long an approved source of funds case clears the buyer before it is asked for again. */
  sourceOfFundsValidityDays: number;
  now?: () => Date;
};

/**
 * Reads, and never changes, the checks Compliance already runs: identity (KYC), watchlist
 * screening with its holds, and source of funds. Staff working on a deal cannot decide any of
 * them here.
 */
export class ComplianceDealClearanceReader implements DealClearancePort {
  constructor(private readonly deps: DealClearanceDeps) {}

  async snapshot(deal: {
    dealId: string;
    seller: DealPartyRef;
    buyer: DealPartyRef | null;
  }): Promise<DealClearanceSnapshot> {
    const [seller, buyer] = await Promise.all([
      this.party(deal.seller),
      deal.buyer ? this.party(deal.buyer) : Promise.resolve(null),
    ]);
    const buyerUserId = deal.buyer?.actingUserId ?? null;
    return {
      seller,
      buyer,
      buyerSourceOfFunds: buyerUserId ? await this.sourceOfFunds(buyerUserId) : "not_requested",
      buyerOtherOpenExposureMinor: deal.buyer
        ? await this.exposure(deal.dealId, deal.buyer.legalEntityId, buyerUserId)
        : 0,
    };
  }

  private async party(ref: DealPartyRef): Promise<PartyClearance> {
    // Checks belong to a person. A party nobody acts for yet has none, so it stays unclear.
    if (!ref.actingUserId) return { kyc: "pending", aml: "pending" };
    const [kyc, aml] = await Promise.all([this.kyc(ref.actingUserId), this.aml(ref.actingUserId)]);
    return { kyc, aml };
  }

  private async kyc(userId: string): Promise<PartyKycStatus> {
    const state = await this.deps.kyc.getUserKycState(userId);
    if (state?.kycStatus === "approved") return "clear";
    if (state?.kycStatus === "rejected") return "failed";
    return "pending";
  }

  private async aml(userId: string): Promise<PartyAmlStatus> {
    const hold = await this.deps.amlHolds.getHold(userId);
    if (hold?.status === "blocked") return "blocked";
    if (hold?.status === "hold") return "review";
    const screening = await this.deps.screenings.findLatestByUserId(userId);
    // Never screened, or a screening still waiting for its first result, is not clear.
    if (!screening) return "pending";
    if (screening.reviewStatus === "blocked") return "blocked";
    if (screening.reviewStatus === "pending") return "review";
    return "clear";
  }

  private async sourceOfFunds(userId: string): Promise<SourceOfFundsStatus> {
    const now = (this.deps.now ?? (() => new Date()))();
    const approved = await this.deps.sourceOfFunds.findLatestApprovedForUser(userId);
    const maxAgeMs = this.deps.sourceOfFundsValidityDays * DAY_MS;
    if (approved?.reviewedAt && now.getTime() - approved.reviewedAt.getTime() <= maxAgeMs) {
      return "approved";
    }
    if (await this.deps.sourceOfFunds.findPendingForUser(userId)) return "pending";
    const latest = await this.deps.sourceOfFunds.findLatestForUser(userId);
    return latest?.status === "rejected" ? "declined" : "not_requested";
  }

  /** What the buyer has open elsewhere: lots won and not yet settled, and their other deals. */
  private async exposure(
    dealId: string,
    buyerLegalEntityId: string,
    buyerUserId: string | null,
  ): Promise<number> {
    const [lots, deals] = await Promise.all([
      buyerUserId ? this.deps.sourceOfFunds.sumActiveBuyerSettlementPence(buyerUserId) : 0,
      this.deps.deals.sumOtherOpenExposureMinor(buyerLegalEntityId, dealId),
    ]);
    return lots + deals;
  }
}
