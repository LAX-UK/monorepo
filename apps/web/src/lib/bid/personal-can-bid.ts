import { resolveKycBidGate } from "@/lib/bid/resolve-kyc-bid-gate";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";

/**
 * Whether the person's own account can bid now, by the same gate as the lot page: no identity
 * check is required of them, or it is approved. A refused check, or a status that could not be
 * read, keeps them from being offered the switch.
 */
export function personalCanBid(input: {
  summary: KycStatusSummaryDto | null | undefined;
  unavailable?: boolean;
}): boolean {
  if (input.unavailable || !input.summary) return false;
  if (input.summary.status === "rejected") return false;
  const gate = resolveKycBidGate(input);
  return gate !== null && (!gate.requiresKyc || input.summary.status === "approved");
}
