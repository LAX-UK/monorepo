import { entityRoleCan } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import type { SaleDeliveryMode } from "@auction/types";
import { isSaleroomDeliveryMode } from "./sale-mode-policy.js";

/** Buyer agents must self-register and be approved before bidding on web. */
export function memberRequiresWebSaleRegistration(
  role: LegalEntityMemberRole | undefined | null,
): boolean {
  return role === "buyer_agent";
}

/** @deprecated Use {@link memberRequiresWebSaleRegistration}. */
export function memberRequiresSaleRegistration(
  role: LegalEntityMemberRole | undefined | null,
): boolean {
  return memberRequiresWebSaleRegistration(role);
}

/**
 * Staff in-room check-in lists the memberships that may bid for their legal entity: a person's
 * own profile, and an organisation's owners, admins and buyer agents. Whether a buyer agent is
 * authorised for the sale is checked when they are checked in.
 */
export function memberEligibleForStaffInRoomCheckIn(
  role: LegalEntityMemberRole | undefined | null,
): boolean {
  return role != null && entityRoleCan(role, "entity.bid.place");
}

export function saleAllowsInRoomCheckIn(deliveryMode: SaleDeliveryMode): boolean {
  return isSaleroomDeliveryMode(deliveryMode);
}

/** Enforce sale_registration.bid_limit when an approved registration exists (any role). */
export function shouldEnforceRegistrationBidLimit(hasApprovedRegistration: boolean): boolean {
  return hasApprovedRegistration;
}
