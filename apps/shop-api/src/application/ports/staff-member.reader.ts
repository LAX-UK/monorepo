import type { ShopStaffRole } from "@auction/shop-domain";

/** A staff member who may use LAX Admin now, with every role in force. */
export type ActiveShopStaffMember = {
  identitySubjectId: string;
  /** The roles in force, in role order; never empty. Capabilities are their union. */
  roles: readonly ShopStaffRole[];
};

export interface ShopStaffMemberReader {
  /** Null when the person holds no LAX Admin role in force (or their access was removed). */
  findActiveByIdentitySubject(subject: string): Promise<ActiveShopStaffMember | null>;
  /** Returns true only if the broker is assigned to the client party. */
  brokerCanAccessClientParty(brokerSubjectId: string, clientPartyId: string): Promise<boolean>;
}
