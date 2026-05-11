import { createHash } from "node:crypto";

/** Stable opaque handle for correlating bids without exposing user ids. */
export function lotBidderRef(lotId: string, userId: string): string {
  return createHash("sha256").update(`${lotId}:${userId}`).digest("hex").slice(0, 16);
}
