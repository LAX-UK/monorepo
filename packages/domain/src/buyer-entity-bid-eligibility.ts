import type { LegalEntityStatus } from "@auction/types";
import { organisationStateAllows } from "./organisation-state-policy.js";

/** Whether a legal entity's state allows placing bids (buyer side). */
export function buyerEntityCanBid(status: LegalEntityStatus): boolean {
  return organisationStateAllows(status, "bid");
}

/** Whether a legal entity's state allows registering for a sale; the same rule as bidding. */
export function buyerEntityCanRegister(status: LegalEntityStatus): boolean {
  return organisationStateAllows(status, "register");
}
