import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";

/** Show compliance strip only when account readiness needs attention. */
export function shouldShowComplianceStrip(
  user: Pick<SessionUser, "emailVerified" | "emailStatus" | "kycStatus" | "twoFactorEnabled">,
  kyc: KycStatusSummaryDto | null,
  addressesCount: number,
): boolean {
  if (user.emailVerified === false) return true;
  if (user.emailStatus === "bounced" || user.emailStatus === "complained") return true;
  if (addressesCount === 0) return true;
  if (user.twoFactorEnabled !== true) return true;
  if (kyc?.requiresKyc === true) return true;
  if (kyc && kyc.status !== "approved" && user.kycStatus !== "approved") return true;
  return false;
}
