import type { Database } from "@auction/db";
import { shopStaffMember } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ShopApiError } from "../errors/shop-api-error.js";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

const SHOP_ADMIN_ROSTER_LOCK_KEY = "shop_staff_admin_roster";

async function lockShopAdminRoster(tx: Database): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${SHOP_ADMIN_ROSTER_LOCK_KEY}))`);
}

async function countActiveShopAdmins(tx: Database): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(shopStaffMember)
    .where(and(eq(shopStaffMember.role, "shop_admin"), isNull(shopStaffMember.disabledAt)));
  return row?.count ?? 0;
}

export async function grantShopStaffRoleInTx(
  tx: Database,
  input: {
    subject: string;
    role: ShopStaffRole;
    operatorSubjectId: string;
  },
): Promise<void> {
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
    if (
      existing[0].role === "shop_admin" &&
      input.role !== "shop_admin" &&
      existing[0].disabledAt === null
    ) {
      await lockShopAdminRoster(tx);
      const activeAdmins = await countActiveShopAdmins(tx);
      if (activeAdmins <= 1) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "Cannot change role of the last active shop admin",
          409,
        );
      }
    }
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
}

export async function grantShopStaffRole(
  db: Database,
  input: {
    subject: string;
    role: ShopStaffRole;
    operatorSubjectId: string;
  },
): Promise<void> {
  await db.transaction(async (tx) => grantShopStaffRoleInTx(tx, input));
}

export async function revokeShopStaffRoleInTx(
  tx: Database,
  input: {
    subject: string;
    operatorSubjectId: string;
  },
): Promise<void> {
  const existing = await tx
    .select({
      id: shopStaffMember.id,
      role: shopStaffMember.role,
      disabledAt: shopStaffMember.disabledAt,
    })
    .from(shopStaffMember)
    .where(eq(shopStaffMember.identitySubjectId, input.subject))
    .limit(1);
  if (!existing[0]) {
    return;
  }
  if (existing[0].role === "shop_admin" && existing[0].disabledAt === null) {
    await lockShopAdminRoster(tx);
    const activeAdmins = await countActiveShopAdmins(tx);
    if (activeAdmins <= 1) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "Cannot revoke the last active shop admin",
        409,
      );
    }
  }
  const disabledAt = new Date();
  await tx
    .update(shopStaffMember)
    .set({ disabledAt })
    .where(eq(shopStaffMember.id, existing[0].id));
  await insertShopAdminAudit(tx, {
    actorSubjectId: input.operatorSubjectId,
    capability: "settings.write",
    action: "staff_grant_revoke",
    targetType: "shop_staff_member",
    targetId: existing[0].id,
    beforeJson: {
      identitySubjectId: input.subject,
      role: existing[0].role,
      disabledAt: existing[0].disabledAt?.toISOString() ?? null,
    },
    afterJson: {
      identitySubjectId: input.subject,
      role: existing[0].role,
      disabledAt: disabledAt.toISOString(),
    },
  });
}

export async function revokeShopStaffRole(
  db: Database,
  input: {
    subject: string;
    operatorSubjectId: string;
  },
): Promise<void> {
  await db.transaction(async (tx) => revokeShopStaffRoleInTx(tx, input));
}
