import type { Database } from "@auction/db";
import { marketingClickIds } from "@auction/db/schema";
import { marketingAttribution } from "@auction/db/schema";
import { lt } from "drizzle-orm";
import type { IMarketingClickIdPurgeRepository } from "../interfaces/marketing-click-id-purge.repository.js";

export class DrizzleMarketingClickIdPurgeRepository implements IMarketingClickIdPurgeRepository {
  constructor(private readonly db: Database) {}

  async purgeStale(staleBefore: Date): Promise<number> {
    const deletedClickIds = await this.db
      .delete(marketingClickIds)
      .where(lt(marketingClickIds.updatedAt, staleBefore))
      .returning({ userId: marketingClickIds.userId });
    const deletedAttribution = await this.db
      .delete(marketingAttribution)
      .where(lt(marketingAttribution.updatedAt, staleBefore))
      .returning({ userId: marketingAttribution.userId });
    return deletedClickIds.length + deletedAttribution.length;
  }
}
