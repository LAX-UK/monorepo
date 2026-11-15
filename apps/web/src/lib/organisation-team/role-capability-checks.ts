import { entityRoleCan } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/** Who may manage purchase documents for an organisation. */
export function canManagePurchaseDocuments(role: LegalEntityMemberRole): boolean {
  return entityRoleCan(role, "entity.documents.manage");
}

/** Members who answer for the organisation's bidding: those who manage members. */
export function countsAsBiddingManager(role: LegalEntityMemberRole): boolean {
  return entityRoleCan(role, "entity.members.manage");
}
