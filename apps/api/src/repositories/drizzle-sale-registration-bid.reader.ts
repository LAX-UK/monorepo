import type { Database } from "@auction/db";
import { saleRegistration } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { ISaleRegistrationBidReader } from "./interfaces/sale-registration-bid.reader.js";

export class DrizzleSaleRegistrationBidReader implements ISaleRegistrationBidReader {
  constructor(private readonly db: Database) {}

  async findRegistration(saleId: string, userId: string, buyerLegalEntityId: string) {
    const [row] = await this.db
      .select({
        status: saleRegistration.status,
        bidLimit: saleRegistration.bidLimit,
      })
      .from(saleRegistration)
      .where(
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.userId, userId),
          eq(saleRegistration.buyerLegalEntityId, buyerLegalEntityId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      status: row.status,
      bidLimit: row.bidLimit != null ? String(row.bidLimit) : null,
    };
  }
}
