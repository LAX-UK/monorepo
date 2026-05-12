import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
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
