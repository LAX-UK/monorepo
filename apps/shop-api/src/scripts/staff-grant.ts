import { closeDb, createDb } from "@auction/db";
import { shopStaffMember } from "@auction/db/schema";
import type { ShopStaffRole } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { loadShopApiEnv } from "../env.js";
import { insertShopAdminAudit } from "../infrastructure/shop-admin-audit.js";

const ROLES: readonly ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];

function usage(): never {
  console.error(
    `Usage: staff-grant --subject <identity-subject-id> --role <${ROLES.join("|")}> --operator <ops:email>`,
  );
  process.exit(1);
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const subject = readArg("--subject")?.trim();
const role = readArg("--role")?.trim() as ShopStaffRole | undefined;
const operator = readArg("--operator")?.trim();

if (!subject || !role || !operator) {
  usage();
}
if (!ROLES.includes(role)) {
  console.error(`Invalid role: ${role}`);
  usage();
}

const env = loadShopApiEnv();
const db = createDb(env.DATABASE_URL_SHOP);

try {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: shopStaffMember.id,
        role: shopStaffMember.role,
        disabledAt: shopStaffMember.disabledAt,
      })
      .from(shopStaffMember)
      .where(eq(shopStaffMember.identitySubjectId, subject))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(shopStaffMember)
        .set({ role, disabledAt: null })
        .where(eq(shopStaffMember.id, existing[0].id));
      await insertShopAdminAudit(tx, {
        actorSubjectId: operator,
        capability: "settings.write",
        action: "staff_grant_update",
        targetType: "shop_staff_member",
        targetId: existing[0].id,
        beforeJson: {
          identitySubjectId: subject,
          role: existing[0].role,
          disabledAt: existing[0].disabledAt?.toISOString() ?? null,
        },
        afterJson: { identitySubjectId: subject, role, disabledAt: null },
      });
      console.log(`Updated shop staff member ${existing[0].id} → role ${role}`);
    } else {
      const [created] = await tx
        .insert(shopStaffMember)
        .values({ identitySubjectId: subject, role })
        .returning({ id: shopStaffMember.id });
      const staffId = created?.id ?? "?";
      if (created?.id) {
        await insertShopAdminAudit(tx, {
          actorSubjectId: operator,
          capability: "settings.write",
          action: "staff_grant_create",
          targetType: "shop_staff_member",
          targetId: created.id,
          afterJson: { identitySubjectId: subject, role },
        });
      }
      console.log(`Created shop staff member ${staffId} with role ${role}`);
    }
  });
} finally {
  await closeDb(db);
}
