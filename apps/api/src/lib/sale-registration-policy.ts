/** Re-export shared sale registration policy from validators (single source of truth). */
export {
  memberEligibleForStaffInRoomCheckIn,
  memberRequiresSaleRegistration,
  memberRequiresWebSaleRegistration,
  saleAllowsInRoomCheckIn,
  shouldEnforceRegistrationBidLimit,
} from "@auction/validators";

export type { LegalEntityMemberRole as EntityMemberRole } from "@auction/types";
