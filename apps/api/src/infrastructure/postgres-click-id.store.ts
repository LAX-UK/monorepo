import type { Database } from "@auction/db";
import { marketingClickIds } from "@auction/db/schema";
import type { IClickIdStore } from "@auction/marketing-events";
import type { ClickIds } from "@auction/types";
import { eq } from "drizzle-orm";

export class PostgresClickIdStore implements IClickIdStore {
  constructor(private readonly db: Database) {}

  async put(userId: string, ids: ClickIds): Promise<void> {
    await this.db
      .insert(marketingClickIds)
      .values({
        userId,
        fbp: ids.fbp ?? null,
        fbc: ids.fbc ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: marketingClickIds.userId,
        set: {
          fbp: ids.fbp ?? null,
          fbc: ids.fbc ?? null,
          updatedAt: new Date(),
        },
      });
  }

  async get(userId: string): Promise<ClickIds | null> {
    const [row] = await this.db
      .select()
      .from(marketingClickIds)
      .where(eq(marketingClickIds.userId, userId))
      .limit(1);
    if (!row) return null;
    return {
      ...(row.fbp ? { fbp: row.fbp } : {}),
      ...(row.fbc ? { fbc: row.fbc } : {}),
    };
  }
}
