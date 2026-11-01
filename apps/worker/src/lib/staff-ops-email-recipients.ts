import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { roleHasCapability } from "@auction/types";
import { and, eq, isNull } from "drizzle-orm";

export type StaffOpsRecipient = {
  id: string;
  email: string;
  firstName: string | null;
};

/** Active platform staff who should receive operational / risk emails. */
export async function listStaffOpsRecipients(db: Database): Promise<StaffOpsRecipient[]> {
  return db
    .select({ id: user.id, email: user.email, firstName: user.firstName })
    .from(user)
    .where(and(eq(user.role, "staff"), isNull(user.suspendedAt)));
}

/**
 * Active staff whose role grants `finance.read` (finance and administrator roles), for
 * emails that carry payment or dispute details.
 */
export async function listStaffFinanceRecipients(db: Database): Promise<StaffOpsRecipient[]> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      staffRole: user.staffRole,
    })
    .from(user)
    .where(and(eq(user.role, "staff"), isNull(user.suspendedAt)));
  return rows
    .filter((r) => roleHasCapability("staff", "finance.read", r.staffRole))
    .map(({ id, email, firstName }) => ({ id, email, firstName }));
}
