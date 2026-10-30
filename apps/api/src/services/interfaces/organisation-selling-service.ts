import type { SaleLineBreakdown, SoldLotPayoutStage } from "@auction/domain";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

export type OrganisationSellingErrorCode =
  | "insufficient_entity_role"
  | "payout_not_found"
  | "agreement_not_found";

export type OrganisationSellingError = {
  code: OrganisationSellingErrorCode;
  status: 403 | 404;
  message: string;
};

export type SellingResult<T> = Promise<Result<T, OrganisationSellingError>>;

/** One sold lot on the Sold tab. */
export type SoldLotView = {
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  saleTitle: string | null;
  soldAt: Date;
  hammerPrice: string;
  stage: SoldLotPayoutStage;
  /** What reaches the seller once the buyer has paid; `null` before then. */
  net: string | null;
  payout: { id: string; settledAt: Date | null } | null;
};

/** One line of a payout's detail. */
export type PayoutLineView = {
  id: string;
  kind: string;
  note: string | null;
  lot: { id: string; title: string; lotNumber: number | null; hammerPrice: string } | null;
  /** Sale lines split into gross, commission and fees, and net; other lines carry the amount. */
  breakdown: SaleLineBreakdown | null;
  amount: string;
};

export type PayoutDetailView = {
  id: string;
  status: string;
  currency: string;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  periodStart: Date;
  periodEnd: Date;
  processedAt: Date | null;
  lines: PayoutLineView[];
};

/** Sold & payouts for the members who see the seller's money (`entity.payouts.read`). */
export interface ISoldAndPayoutsService {
  listSold(
    actor: OrganisationMemberActor,
    page: { limit: number; offset: number; year?: number | undefined },
  ): SellingResult<{ items: SoldLotView[]; nextOffset: number | null }>;
  exportSoldCsv(
    actor: OrganisationMemberActor,
    filter: { year?: number | undefined },
  ): SellingResult<string>;
  payoutDetail(actor: OrganisationMemberActor, payoutId: string): SellingResult<PayoutDetailView>;
}

/** A work that came back unsold, which the account can consign again. */
export type ReturnedWorkView = {
  submissionId: string;
  lotId: string;
  title: string;
  medium: string | null;
  reference: string;
  returnedAt: Date | null;
  /** The member may start a new consignment from it (`entity.submissions.create`). */
  canConsignAgain: boolean;
};

export interface IReturnedWorksService {
  list(
    actor: OrganisationMemberActor,
    page: { limit: number; offset: number },
  ): SellingResult<{ items: ReturnedWorkView[]; nextOffset: number | null }>;
}

/** The consignment agreement as a PDF the seller keeps. */
export interface IAgreementDocumentService {
  render(
    actor: OrganisationMemberActor,
    submissionId: string,
  ): SellingResult<{ filename: string; pdf: Buffer }>;
}
