import type { Database } from "@auction/db";
import { buyerAgentAuthorisation } from "@auction/db/schema";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { IBuyerAgentAuthorisationReader } from "../interfaces/buyer-agent-authorisation.reader.js";

export class DrizzleBuyerAgentAuthorisationReader implements IBuyerAgentAuthorisationReader {
  constructor(private readonly db: Database) {}

  async findActiveAuthorisations(params: {
    legalEntityId: string;
    userId: string;
    saleId: string | null;
    now: Date;
  }) {
    const { legalEntityId, userId, saleId, now } = params;
    const rows = await this.db
      .select({
        saleId: buyerAgentAuthorisation.saleId,
        bidLimit: buyerAgentAuthorisation.bidLimit,
      })
      .from(buyerAgentAuthorisation)
      .where(
        and(
          eq(buyerAgentAuthorisation.legalEntityId, legalEntityId),
          eq(buyerAgentAuthorisation.userId, userId),
          eq(buyerAgentAuthorisation.status, "active"),
          lte(buyerAgentAuthorisation.validFrom, now),
          or(
            isNull(buyerAgentAuthorisation.validUntil),
            gt(buyerAgentAuthorisation.validUntil, now),
          ),
          saleId
            ? or(isNull(buyerAgentAuthorisation.saleId), eq(buyerAgentAuthorisation.saleId, saleId))
            : isNull(buyerAgentAuthorisation.saleId),
        ),
      );
    return rows.map((row) => ({
      saleId: row.saleId,
      bidLimit: row.bidLimit != null ? String(row.bidLimit) : null,
    }));
  }
}
