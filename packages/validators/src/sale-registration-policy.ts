import type { LegalEntityKind, LegalEntityMemberRole } from "@auction/types";
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

/** Staff in-room check-in: personal collectors (owner on individual) or buyer agents on orgs. */
export function memberEligibleForStaffInRoomCheckIn(
  role: LegalEntityMemberRole | undefined | null,
  entityKind: LegalEntityKind,
): boolean {
  if (role === "owner" && entityKind === "individual") return true;
  if (role === "buyer_agent" && entityKind === "organisation") return true;
  return false;
}

export function saleAllowsInRoomCheckIn(deliveryMode: SaleDeliveryMode): boolean {
  return isSaleroomDeliveryMode(deliveryMode);
}

/** Enforce sale_registration.bid_limit when an approved registration exists (any role). */
export function shouldEnforceRegistrationBidLimit(hasApprovedRegistration: boolean): boolean {
  return hasApprovedRegistration;
}
