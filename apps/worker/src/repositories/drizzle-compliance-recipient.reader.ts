import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";

const COMPLIANCE_STAFF_ROLES = ["compliance_officer", "super_admin"] as const;

export class DrizzleComplianceRecipientReader implements IComplianceRecipientReader {
  constructor(private readonly db: Database) {}

  async listRecipients() {
    return this.db
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
}
