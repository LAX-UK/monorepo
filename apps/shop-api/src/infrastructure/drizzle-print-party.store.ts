import type { Database } from "@auction/db";
import { shopPrintParty } from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type { PrintPartyStore } from "../application/ports/print-party.store.js";

export function createDrizzlePrintPartyStore(db: Database): PrintPartyStore {
  return {
    async list() {
      return db
        .select({ id: shopPrintParty.id, name: shopPrintParty.name })
        .from(shopPrintParty)
        .orderBy(asc(sql`lower(${shopPrintParty.name})`));
    },

    async add(name, actorSubjectId) {
      const [row] = await db
        .insert(shopPrintParty)
        .values({ name, createdBy: actorSubjectId })
        .onConflictDoNothing()
        .returning({ id: shopPrintParty.id, name: shopPrintParty.name });
      return row ?? "exists";
    },

    async remove(id) {
      const removed = await db
        .delete(shopPrintParty)
        .where(eq(shopPrintParty.id, id))
        .returning({ id: shopPrintParty.id });
      return removed.length > 0;
    },
  };
}
