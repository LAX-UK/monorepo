import type { Database } from "@auction/db";
import { verification } from "@auction/db/schema";
import { lt } from "drizzle-orm";
import type { IVerificationPurgeRepository } from "../interfaces/verification-purge.repository.js";

export class DrizzleVerificationPurgeRepository implements IVerificationPurgeRepository {
  constructor(private readonly db: Database) {}

  async purgeBefore(cutoff: Date): Promise<{ deleted: number }> {
    const deleted = await this.db
      .delete(verification)
      .where(lt(verification.expiresAt, cutoff))
      .returning({ id: verification.id });
    return { deleted: deleted.length };
  }
}
