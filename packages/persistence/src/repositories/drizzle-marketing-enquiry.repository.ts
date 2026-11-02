import type { Database } from "@auction/db";
import { marketingEnquiry } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  IMarketingEnquiryRepository,
  MarketingEnquiryRecord,
  MarketingEnquiryStatus,
  NewMarketingEnquiry,
} from "../interfaces/marketing-enquiry.repository.js";

function toRecord(row: typeof marketingEnquiry.$inferSelect): MarketingEnquiryRecord {
  return {
    id: row.id,
    topic: row.topic,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    sourcePage: row.sourcePage,
    status: row.status as MarketingEnquiryStatus,
    createdAt: row.createdAt,
    handledAt: row.handledAt,
    handledByUserId: row.handledByUserId,
  };
}

export class DrizzleMarketingEnquiryRepository implements IMarketingEnquiryRepository {
  constructor(private readonly db: Database) {}

  async createInTransaction(
    tx: Database,
    input: NewMarketingEnquiry,
  ): Promise<MarketingEnquiryRecord> {
    const [row] = await tx
      .insert(marketingEnquiry)
      .values({
        topic: input.topic,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        message: input.message,
        sourcePage: input.sourcePage ?? null,
      })
      .returning();
    if (!row) throw new Error("marketing enquiry insert returned no row");
    return toRecord(row);
  }

  async findById(id: string): Promise<MarketingEnquiryRecord | null> {
    const [row] = await this.db
      .select()
      .from(marketingEnquiry)
      .where(eq(marketingEnquiry.id, id))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async markHandledInTransaction(
    tx: Database,
    id: string,
    handledByUserId: string,
    at: Date,
  ): Promise<MarketingEnquiryRecord | null> {
    const [row] = await tx
      .update(marketingEnquiry)
      .set({ status: "handled", handledAt: at, handledByUserId })
      .where(and(eq(marketingEnquiry.id, id), eq(marketingEnquiry.status, "new")))
      .returning();
    return row ? toRecord(row) : null;
  }
}
