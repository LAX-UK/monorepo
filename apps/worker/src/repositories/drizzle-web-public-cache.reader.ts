import type { Database } from "@auction/db";
import { domainEvent, lot } from "@auction/db/schema";
import { desc, eq } from "drizzle-orm";

/** The two reads the `web_public_cache` projector needs besides its cursor. */
export class DrizzleWebPublicCacheReader {
  constructor(private readonly db: Database) {}

  async lotSaleId(lotId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ saleId: lot.saleId })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    return row?.saleId ?? null;
  }

  async latestEventId(): Promise<number> {
    const [row] = await this.db
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .orderBy(desc(domainEvent.id))
      .limit(1);
    return row?.id ?? 0;
  }
}
