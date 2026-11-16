import type { Database } from "@auction/db";
import { enquiryInboundQuarantine } from "@auction/db/schema";
import { inArray, lte } from "drizzle-orm";
import type { IEnquiryQuarantinePurgeRepository } from "../interfaces/enquiry-quarantine-purge.repository.js";

export class DrizzleEnquiryQuarantinePurgeRepository implements IEnquiryQuarantinePurgeRepository {
  constructor(private readonly db: Database) {}

  async purgeDue(now: Date, batchSize: number): Promise<{ deleted: number; batchCount: number }> {
    const rows = await this.db
      .select({ id: enquiryInboundQuarantine.id })
      .from(enquiryInboundQuarantine)
      .where(lte(enquiryInboundQuarantine.purgeAt, now))
      .orderBy(enquiryInboundQuarantine.purgeAt)
      .limit(batchSize);
    if (rows.length === 0) return { deleted: 0, batchCount: 0 };

    // A row a concurrent run already deleted is simply not returned: the purge is idempotent.
    const removed = await this.db
      .delete(enquiryInboundQuarantine)
      .where(
        inArray(
          enquiryInboundQuarantine.id,
          rows.map((row) => row.id),
        ),
      )
      .returning({ id: enquiryInboundQuarantine.id });
    return { deleted: removed.length, batchCount: rows.length };
  }
}
