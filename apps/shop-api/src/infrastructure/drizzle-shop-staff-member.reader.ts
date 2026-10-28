import type { Database } from "@auction/db";
import { shopClientAssignment, shopStaffMember } from "@auction/db/schema";
import { normalizeLaxAdminRoles } from "@auction/types";
import { and, eq, isNull } from "drizzle-orm";
import type {
  ActiveShopStaffMember,
  ShopStaffMemberReader,
} from "../application/ports/staff-member.reader.js";
import { activeShopStaffRolesSql } from "./shop-staff-active-roles.sql.js";

export function createDrizzleShopStaffMemberReader(db: Database): ShopStaffMemberReader {
  return {
    async findActiveByIdentitySubject(subject: string): Promise<ActiveShopStaffMember | null> {
      const [row] = await db
        .select({
          identitySubjectId: shopStaffMember.identitySubjectId,
          roles: activeShopStaffRolesSql(shopStaffMember.identitySubjectId),
        })
        .from(shopStaffMember)
        .where(
          and(eq(shopStaffMember.identitySubjectId, subject), isNull(shopStaffMember.disabledAt)),
        )
        .limit(1);
      const roles = normalizeLaxAdminRoles(row?.roles ?? []);
      if (!row || roles.length === 0) return null;
      return { identitySubjectId: row.identitySubjectId, roles };
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
