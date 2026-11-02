import type { BidCoverViewer } from "./bid-cover.adapter";

/**
 * Where a signed-in person stands with a sale, from the statuses of their registrations for it.
 * One approved registration is enough to bid; otherwise a pending one means waiting; a rejected
 * one with nothing better is declined. Withdrawn registrations count for nothing.
 */
export function viewerFromRegistrations(statuses: readonly string[]): BidCoverViewer {
  if (statuses.includes("approved")) return "approved";
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("rejected")) return "declined";
  return "anonymous";
}
