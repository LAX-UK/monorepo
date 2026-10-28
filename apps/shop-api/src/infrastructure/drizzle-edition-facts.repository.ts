import type { Database } from "@auction/db";
import { shopEditionFacts } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type { EditionFactsRepository } from "../application/ports/edition-facts.repository.js";
import { factsFromColumns, factsToColumns } from "./edition-facts-columns.js";

export function createDrizzleEditionFactsRepository(db: Database): EditionFactsRepository {
  return {
    async getFacts(artworkId) {
      const [row] = await db
        .select()
        .from(shopEditionFacts)
        .where(eq(shopEditionFacts.artworkId, artworkId))
        .limit(1);
      return row ? factsFromColumns(row) : null;
    },

    async saveFacts(artworkId, facts) {
      const columns = factsToColumns(facts);
      await db
        .insert(shopEditionFacts)
        .values({ artworkId, ...columns })
        .onConflictDoUpdate({
          target: shopEditionFacts.artworkId,
          set: { ...columns, updatedAt: sql`now()` },
        });
    },
  };
}
