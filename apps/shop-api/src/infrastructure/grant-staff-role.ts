import type { Database } from "@auction/db";
import { shopStaffMember } from "@auction/db/schema";
import type { ShopStaffRole } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

export async function grantShopStaffRole(
  db: Database,
  input: {
    subject: string;
    role: ShopStaffRole;
    operatorSubjectId: string;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: shopStaffMember.id,
        role: shopStaffMember.role,
        disabledAt: shopStaffMember.disabledAt,
      })
      .from(shopStaffMember)
      .where(eq(shopStaffMember.identitySubjectId, input.subject))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(shopStaffMember)
        .set({ role: input.role, disabledAt: null })
        .where(eq(shopStaffMember.id, existing[0].id));
      await insertShopAdminAudit(tx, {
        actorSubjectId: input.operatorSubjectId,
        capability: "settings.write",
        action: "staff_grant_update",
        targetType: "shop_staff_member",
        targetId: existing[0].id,
        beforeJson: {
          identitySubjectId: input.subject,
          role: existing[0].role,
          disabledAt: existing[0].disabledAt?.toISOString() ?? null,
        },
        afterJson: { identitySubjectId: input.subject, role: input.role, disabledAt: null },
      });
    } else {
      const [created] = await tx
        .insert(shopStaffMember)
        .values({ identitySubjectId: input.subject, role: input.role })
        .returning({ id: shopStaffMember.id });
      if (!created) {
        throw new Error("Failed to create shop staff member");
      }
      await insertShopAdminAudit(tx, {
        actorSubjectId: input.operatorSubjectId,
        capability: "settings.write",
        action: "staff_grant_create",
        targetType: "shop_staff_member",
        targetId: created.id,
        afterJson: { identitySubjectId: input.subject, role: input.role },
      });
    }
  });
}
