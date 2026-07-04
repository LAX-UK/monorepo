import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";

export class DrizzleStaffOpsRecipientReader implements IStaffOpsRecipientReader {
  constructor(private readonly db: Database) {}

  async listRecipients() {
    return this.db
      .select({ id: user.id, email: user.email, firstName: user.firstName })
      .from(user)
      .where(and(eq(user.role, "staff"), isNull(user.suspendedAt)));
  }
}
