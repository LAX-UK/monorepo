import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { type ConsignmentChecklistFacts, agreementTermsComplete } from "@auction/domain";
import type { ConsignmentAgreement, ItemSubmission, LegalEntityStatus, Lot } from "@auction/types";

/** Facts about the account a consignment belongs to, shared by all its consignments. */
export type SellerAccountFacts = {
  accountKind: ConsignmentChecklistFacts["accountKind"];
  identity: ConsignmentChecklistFacts["identity"];
  payoutsReady: boolean;
  viewer: ConsignmentChecklistFacts["viewer"];
};

const ORGANISATION_VERIFIED: ReadonlySet<LegalEntityStatus> = new Set(["approved", "restricted"]);

/** A person's identity, from their verification summary. */
export function personalIdentityFact(
  kyc: Pick<KycStatusSummaryDto, "status"> | null,
): ConsignmentChecklistFacts["identity"] {
  if (kyc?.status === "approved") return "verified";
  if (kyc?.status === "pending") return "checking";
  return "required";
}

/** An organisation is verified through its documents, checked by LAX. */
export function organisationIdentityFact(
  status: LegalEntityStatus | null,
): ConsignmentChecklistFacts["identity"] {
  if (status && ORGANISATION_VERIFIED.has(status)) return "verified";
  return "checking";
}

/** The facts for one consignment's checklist. */
export function consignmentChecklistFacts(input: {
  submission: Pick<ItemSubmission, "status">;
  agreement: Pick<
    ConsignmentAgreement,
    "acceptedAt" | "estimateLow" | "estimateHigh" | "commissionPercent"
  > | null;
  account: SellerAccountFacts;
  lot: Pick<Lot, "saleId" | "startTime" | "status"> | null;
}): ConsignmentChecklistFacts {
  return {
    submissionStatus: input.submission.status,
    lotStatus: input.lot?.status ?? null,
    accountKind: input.account.accountKind,
    identity: input.account.identity,
    agreement: {
      // A proposal without an estimate and commission is not one the seller can accept yet.
      proposed: input.agreement !== null && agreementTermsComplete(input.agreement),
      accepted: Boolean(input.agreement?.acceptedAt),
    },
    payoutsReady: input.account.payoutsReady,
    viewer: input.account.viewer,
    saleStartsAt: input.lot?.saleId ? input.lot.startTime : null,
  };
}
