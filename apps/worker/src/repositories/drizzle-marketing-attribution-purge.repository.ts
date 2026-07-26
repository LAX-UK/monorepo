import type { Database } from "@auction/db";
import { marketingAttribution } from "@auction/db/schema";
import { lt } from "drizzle-orm";
import type { IMarketingAttributionPurgeRepository } from "../interfaces/marketing-attribution-purge.repository.js";

export class DrizzleMarketingAttributionPurgeRepository
  implements IMarketingAttributionPurgeRepository
{
  constructor(private readonly db: Database) {}

  async purgeStale(staleBefore: Date): Promise<number> {
    const deleted = await this.db
      .delete(marketingAttribution)
      .where(lt(marketingAttribution.updatedAt, staleBefore))
      .returning({ userId: marketingAttribution.userId });
    return deleted.length;
  }
}
