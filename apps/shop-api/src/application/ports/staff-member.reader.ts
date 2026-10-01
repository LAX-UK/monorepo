import type { ShopStaffRole } from "@auction/shop-domain";

export type ActiveShopStaffMember = {
  identitySubjectId: string;
  role: ShopStaffRole;
};

export interface ShopStaffMemberReader {
  findActiveByIdentitySubject(subject: string): Promise<ActiveShopStaffMember | null>;
  /** When role is broker, returns true only if the broker is assigned to the client party. */
  brokerCanAccessClientParty(brokerSubjectId: string, clientPartyId: string): Promise<boolean>;
}
