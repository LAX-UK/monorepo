import type { Database } from "@auction/db";
import { shopStaffMember } from "@auction/db/schema";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";

/** Temporarily disables other active shop_admin rows so roster guard tests are deterministic. */
export async function withIsolatedShopAdmins(
  db: Database,
  keepIdentitySubjectIds: string[],
  fn: () => Promise<void>,
): Promise<void> {
  const paused = await db
    .update(shopStaffMember)
    .set({ disabledAt: new Date() })
    .where(
      and(
        eq(shopStaffMember.role, "shop_admin"),
        isNull(shopStaffMember.disabledAt),
        notInArray(shopStaffMember.identitySubjectId, keepIdentitySubjectIds),
      ),
    )
    .returning({ id: shopStaffMember.id });

  try {
    await fn();
  } finally {
    if (paused.length > 0) {
      await db
        .update(shopStaffMember)
        .set({ disabledAt: null })
        .where(
          inArray(
            shopStaffMember.id,
            paused.map((row) => row.id),
          ),
        );
    }
  }
}
