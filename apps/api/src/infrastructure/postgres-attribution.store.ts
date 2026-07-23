import type { Database } from "@auction/db";
import { marketingAttribution } from "@auction/db/schema";
import type { IAttributionStore } from "@auction/marketing-events";
import type { MarketingAttributionSnapshot, MarketingAttributionTouch } from "@auction/types";
import { MARKETING_ATTRIBUTION_VERSION } from "@auction/types";
import { parseMarketingAttributionSnapshot } from "@auction/validators";
import { eq, sql } from "drizzle-orm";

function rowToSnapshot(row: {
  firstTouch: MarketingAttributionTouch | null;
  lastTouch: MarketingAttributionTouch | null;
}): MarketingAttributionSnapshot | null {
  if (!row.firstTouch && !row.lastTouch) return null;
  return parseMarketingAttributionSnapshot({
    version: MARKETING_ATTRIBUTION_VERSION,
    ...(row.firstTouch ? { firstTouch: row.firstTouch } : {}),
    ...(row.lastTouch ? { lastTouch: row.lastTouch } : {}),
  });
}

export class PostgresAttributionStore implements IAttributionStore {
  constructor(private readonly db: Database) {}

  async put(userId: string, snapshot: MarketingAttributionSnapshot): Promise<void> {
    await this.db
      .insert(marketingAttribution)
      .values({
        userId,
        firstTouch: snapshot.firstTouch ?? null,
        lastTouch: snapshot.lastTouch ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: marketingAttribution.userId,
        set: {
          firstTouch: sql`coalesce(${marketingAttribution.firstTouch}, excluded.first_touch)`,
          lastTouch: sql`
            case
              when excluded.last_touch is null then ${marketingAttribution.lastTouch}
              when ${marketingAttribution.lastTouch} is null then excluded.last_touch
              when (excluded.last_touch ->> 'capturedAt')::timestamptz
                >= (${marketingAttribution.lastTouch} ->> 'capturedAt')::timestamptz
                then excluded.last_touch
              else ${marketingAttribution.lastTouch}
            end
          `,
          updatedAt: new Date(),
        },
      });
  }

  async get(userId: string): Promise<MarketingAttributionSnapshot | null> {
    const [row] = await this.db
      .select()
      .from(marketingAttribution)
      .where(eq(marketingAttribution.userId, userId))
      .limit(1);
    if (!row) return null;
    return rowToSnapshot({
      firstTouch: row.firstTouch ?? null,
      lastTouch: row.lastTouch ?? null,
    });
  }

  async delete(userId: string): Promise<void> {
    await this.db.delete(marketingAttribution).where(eq(marketingAttribution.userId, userId));
  }
}
