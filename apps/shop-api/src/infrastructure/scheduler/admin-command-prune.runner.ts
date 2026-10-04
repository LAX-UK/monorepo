import type { Database } from "@auction/db";
import { shopAdminCommand } from "@auction/db/schema";
import { lt } from "drizzle-orm";

const RETENTION_DAYS = 30;

export function createAdminCommandPruneRunner(db: Database): (now: Date) => Promise<number> {
  return async (now) => {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(shopAdminCommand)
      .where(lt(shopAdminCommand.createdAt, cutoff))
      .returning({ commandType: shopAdminCommand.commandType });
    return deleted.length;
  };
}
