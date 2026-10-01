import type { Database } from "@auction/db";
import { shopClientAssignment, shopStaffMember } from "@auction/db/schema";
import type { ShopStaffRole } from "@auction/shop-domain";
import { and, eq, isNull } from "drizzle-orm";
import type {
  ActiveShopStaffMember,
  ShopStaffMemberReader,
} from "../application/ports/staff-member.reader.js";

export function createDrizzleShopStaffMemberReader(db: Database): ShopStaffMemberReader {
  return {
    async findActiveByIdentitySubject(subject: string): Promise<ActiveShopStaffMember | null> {
      const [row] = await db
        .select({
          identitySubjectId: shopStaffMember.identitySubjectId,
          role: shopStaffMember.role,
        })
        .from(shopStaffMember)
        .where(
          and(eq(shopStaffMember.identitySubjectId, subject), isNull(shopStaffMember.disabledAt)),
        )
        .limit(1);
      if (!row) return null;
      return {
        identitySubjectId: row.identitySubjectId,
        role: row.role as ShopStaffRole,
      };
    },

    async brokerCanAccessClientParty(
      brokerSubjectId: string,
      clientPartyId: string,
    ): Promise<boolean> {
      const [assignment] = await db
        .select({ id: shopClientAssignment.id })
        .from(shopClientAssignment)
        .where(
          and(
            eq(shopClientAssignment.brokerSubjectId, brokerSubjectId),
            eq(shopClientAssignment.clientPartyId, clientPartyId),
          ),
        )
        .limit(1);
      return assignment !== undefined;
    },
  };
}
