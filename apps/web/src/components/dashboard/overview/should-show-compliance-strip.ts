import type { PayoutSetupPill } from "@/components/dashboard/overview/compliance-status-strip";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";

/** Show compliance strip only when account readiness needs attention. */
export function shouldShowComplianceStrip(
  user: Pick<SessionUser, "emailVerified" | "emailStatus" | "twoFactorEnabled">,
  kyc: KycStatusSummaryDto | null,
  addressesCount: number,
): boolean {
  if (user.emailVerified === false) return true;
  if (user.emailStatus === "bounced" || user.emailStatus === "complained") return true;
  if (addressesCount === 0) return true;
  if (user.twoFactorEnabled !== true) return true;
  if (kyc && kyc.status !== "approved") return true;
  return false;
}

/** Seller workspace: buyer readiness rules plus payout setup when Connect is enforced. */
export function shouldShowSellerComplianceStrip(
  user: Pick<SessionUser, "emailVerified" | "emailStatus" | "twoFactorEnabled">,
  kyc: KycStatusSummaryDto | null,
  addressesCount: number,
  payoutSetup: PayoutSetupPill | null,
): boolean {
  if (shouldShowComplianceStrip(user, kyc, addressesCount)) return true;
  if (payoutSetup && !payoutSetup.ready) return true;
  return false;
}
