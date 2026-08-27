import { resolveKycSurfaceFeedback } from "@/lib/bid/resolve-kyc-bid-gate";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type { LotPageSecondaryData, LotPageShellData } from "@/lib/marketing/lot-page-data.service";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import type { SelfServiceActorKycStatus } from "@auction/domain";
import type { Sale } from "@auction/types";
import type {
  LotConditionReportSessionInput,
  LotConditionReportViewModel,
} from "./lot-condition-report-session-input";

function normalizeKycStatus(
  status: SelfServiceActorKycStatus | undefined,
): SelfServiceActorKycStatus {
  if (status === "pending" || status === "approved" || status === "rejected") {
    return status;
  }
  return "unverified";
}

export function buildLotConditionReportViewModel(input: {
  auction: LotPageShellData["auction"];
  session: LotPageShellData["session"];
  saleDeliveryMode: Sale["deliveryMode"] | null | undefined;
  auctionStatus: LotPageShellData["auction"]["status"];
  kycSummary: LotPageShellData["kycSummary"];
  kycUnavailable: boolean;
  kycFeedbackDto: KycUserFeedbackDto | null;
  loginNextPath: string;
  canParticipate: boolean;
  publishedConditionReport: LotConditionReportSessionInput["published"];
  buyerConditionReportRequest: LotPageSecondaryData["buyerConditionReportRequest"];
}): LotConditionReportViewModel {
  const isOnsiteSale =
    input.saleDeliveryMode != null && !saleAllowsWebBidding(input.saleDeliveryMode);
  const show =
    !isOnsiteSale && (input.auctionStatus === "scheduled" || input.auctionStatus === "active");
  const kycStatus = normalizeKycStatus(input.session?.kycStatus);
  const kycApproved = kycStatus === "approved";
  const resolvedFeedback = resolveKycSurfaceFeedback({
    summary: input.kycSummary,
    unavailable: input.kycUnavailable,
  });
  const kycFeedback =
    input.kycFeedbackDto?.detail ??
    input.kycFeedbackDto?.headline ??
    (kycApproved ? null : (resolvedFeedback?.detail ?? resolvedFeedback?.headline ?? null));

  const session: LotConditionReportSessionInput = {
    lotId: input.auction.id,
    loginNextPath: input.loginNextPath,
    show,
    canParticipate: input.canParticipate,
    session: input.session
      ? {
          isAuthenticated: true,
          emailVerified: input.session.emailVerified === true,
          email: input.session.email ?? null,
          kycStatus,
          kycFeedback,
          userId: input.session.id ?? null,
        }
      : null,
    published: input.publishedConditionReport,
    buyerRequest: input.buyerConditionReportRequest,
  };

  return { session, kycFeedbackDto: input.kycFeedbackDto };
}
