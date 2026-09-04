import type { IdentityDatabase } from "@auction/identity-db";
import { verification } from "@auction/identity-db/schema";
import { inArray, sql } from "drizzle-orm";
import type { IIdentityVerificationPurger } from "../services/identity-operations.ports.js";

export class DrizzleIdentityVerificationPurger implements IIdentityVerificationPurger {
  constructor(private readonly db: IdentityDatabase) {}

  async purgeExpired(now: Date, batchSize: number): Promise<number> {
    const rows = await this.db
      .delete(verification)
      .where(
        inArray(
          verification.id,
          this.db
            .select({ id: verification.id })
            .from(verification)
            .where(sql`${verification.expiresAt} < ${now}`)
            .limit(batchSize),
        ),
      )
      .returning({ id: verification.id });
    return rows.length;
  }
}
