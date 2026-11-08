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
  // Deliberate: a refused identity check hides the switch, even though the API lets a rejected
  // person under the threshold bid. Offering a one-tap switch into an account whose check was
  // refused would send them to a dead end; do not relax this to match the API.
  if (input.summary.status === "rejected") return false;
  const gate = resolveKycBidGate(input);
  return gate !== null && (!gate.requiresKyc || input.summary.status === "approved");
}
