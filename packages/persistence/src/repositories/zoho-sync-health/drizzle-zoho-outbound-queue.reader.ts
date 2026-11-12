import type { Database } from "@auction/db";
import { domainEventDelivery as delivery } from "@auction/db/schema";
import { inArray, sql } from "drizzle-orm";
import type {
  IZohoOutboundQueueReader,
  ZohoOutboundQueueStats,
} from "../../interfaces/zoho-sync-health.js";
import { ZOHO_PRODUCT_WRITE_CONSUMERS } from "../artwork-register/drizzle-zoho-listing.js";

const UNFINISHED = sql`${delivery.status} IN ('pending', 'processing', 'retryable')`;

/** The queue of writes to Zoho Products, from the delivery ledger, in one query. */
export class DrizzleZohoOutboundQueueReader implements IZohoOutboundQueueReader {
  constructor(private readonly db: Database) {}

  async stats(): Promise<ZohoOutboundQueueStats> {
    const [row] = await this.db
      .select({
        depth: sql<number>`count(*) FILTER (WHERE ${UNFINISHED})::int`,
        oldest: sql<Date | null>`min(${delivery.createdAt}) FILTER (WHERE ${UNFINISHED})`,
        deadLettered: sql<number>`count(*) FILTER (WHERE ${delivery.status} = 'dead_lettered')::int`,
      })
      .from(delivery)
      .where(inArray(delivery.consumer, ZOHO_PRODUCT_WRITE_CONSUMERS));
    return {
      depth: row?.depth ?? 0,
      oldestPendingAt: row?.oldest ? new Date(row.oldest) : null,
      deadLettered: row?.deadLettered ?? 0,
    };
  }
}
