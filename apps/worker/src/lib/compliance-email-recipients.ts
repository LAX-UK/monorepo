import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

export type ComplianceRecipient = {
  id: string;
  email: string;
  firstName: string | null;
};

/** Staff roles entitled to receive MLRO / compliance escalations. */
const COMPLIANCE_STAFF_ROLES = ["compliance_officer", "super_admin"] as const;

/**
 * Active platform staff who should receive AML / Source-of-Funds escalation
 * emails (the MLRO and platform admins). Falls back to an empty list when no
 * such staff exist; callers may then use a configured admin address.
 */
export async function listComplianceRecipients(db: Database): Promise<ComplianceRecipient[]> {
  return db
    .select({ id: user.id, email: user.email, firstName: user.firstName })
    .from(user)
    .where(
      and(
        eq(user.role, "staff"),
        isNull(user.suspendedAt),
        inArray(user.staffRole, [...COMPLIANCE_STAFF_ROLES]),
      ),
    );
}
