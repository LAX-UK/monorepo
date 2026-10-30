import type { Database } from "@auction/db";
import { legalEntityBiddingLimit } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  IOrganisationBiddingLimitReader,
  IOrganisationBiddingLimitWriter,
  OrganisationBiddingLimitRecord,
} from "../interfaces/bidding-limits.repository.js";

export class DrizzleOrganisationBiddingLimitRepository
  implements IOrganisationBiddingLimitReader, IOrganisationBiddingLimitWriter
{
  constructor(private readonly db: Database) {}

  async find(
    legalEntityId: string,
    conn: Database = this.db,
  ): Promise<OrganisationBiddingLimitRecord | null> {
    const [row] = await conn
      .select({
        legalEntityId: legalEntityBiddingLimit.legalEntityId,
        limitAmount: legalEntityBiddingLimit.limitAmount,
        setByUserId: legalEntityBiddingLimit.setByUserId,
        updatedAt: legalEntityBiddingLimit.updatedAt,
      })
      .from(legalEntityBiddingLimit)
      .where(eq(legalEntityBiddingLimit.legalEntityId, legalEntityId))
      .limit(1);
    return row ? { ...row, limitAmount: String(row.limitAmount) } : null;
  }

  async set(input: {
    legalEntityId: string;
    limitAmount: string;
    setByUserId: string;
  }): Promise<{ previousAmount: string | null }> {
    return this.db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ limitAmount: legalEntityBiddingLimit.limitAmount })
        .from(legalEntityBiddingLimit)
        .where(eq(legalEntityBiddingLimit.legalEntityId, input.legalEntityId))
        .for("update");
      const values = {
        limitAmount: input.limitAmount,
        setByUserId: input.setByUserId,
        updatedAt: new Date(),
      };
      await tx
        .insert(legalEntityBiddingLimit)
        .values({ legalEntityId: input.legalEntityId, ...values })
        .onConflictDoUpdate({ target: legalEntityBiddingLimit.legalEntityId, set: values });
      return { previousAmount: previous ? String(previous.limitAmount) : null };
    });
  }

  async clear(legalEntityId: string): Promise<{ previousAmount: string | null }> {
    const [removed] = await this.db
      .delete(legalEntityBiddingLimit)
      .where(eq(legalEntityBiddingLimit.legalEntityId, legalEntityId))
      .returning({ limitAmount: legalEntityBiddingLimit.limitAmount });
    return { previousAmount: removed ? String(removed.limitAmount) : null };
  }
}
