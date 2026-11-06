import type { Database } from "@auction/db";
import { shopArtwork, shopEditionFacts } from "@auction/db/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { EditionRunsReader } from "../../application/edition-runs/basket-edition.js";
import type { EditionCardFactsReader } from "../../application/edition-runs/edition-card-lines.js";
import { factsFromColumns } from "../edition-facts-columns.js";
import { proofsKeptFromColumns, runFromColumns } from "../edition-run-columns.js";

/** The runs of a page of artworks, with their facts where stored: one query, plus one for the main runs of proofs. */
export function createDrizzleEditionRunsReader(db: Database): EditionRunsReader {
  return {
    async runsOf(artworkIds) {
      if (artworkIds.length === 0) return [];
      const rows = await db
        .select({ artwork: shopArtwork, facts: shopEditionFacts })
        .from(shopArtwork)
        .leftJoin(shopEditionFacts, eq(shopEditionFacts.artworkId, shopArtwork.id))
        .where(and(inArray(shopArtwork.id, [...artworkIds]), isNotNull(shopArtwork.runKind)));
      const mainIds = [
        ...new Set(
          rows.flatMap(({ artwork }) =>
            artwork.mainRunArtworkId ? [artwork.mainRunArtworkId] : [],
          ),
        ),
      ];
      const mains =
        mainIds.length === 0
          ? []
          : await db.select().from(shopArtwork).where(inArray(shopArtwork.id, mainIds));
      const mainById = new Map(mains.map((main) => [main.id, main]));
      return rows.flatMap(({ artwork, facts }) => {
        const main = artwork.mainRunArtworkId ? mainById.get(artwork.mainRunArtworkId) : undefined;
        const stored = runFromColumns(artwork, main ? proofsKeptFromColumns(main) : null);
        return stored
          ? [
              {
                artworkId: artwork.id,
                run: stored.spec,
                facts: facts ? factsFromColumns(facts) : null,
              },
            ]
          : [];
      });
    },
  };
}

/** Runs with stored facts, for the card line. */
export function createDrizzleEditionCardFactsReader(db: Database): EditionCardFactsReader {
  const runs = createDrizzleEditionRunsReader(db);
  return {
    async runsWithFacts(artworkIds) {
      return (await runs.runsOf(artworkIds)).flatMap(({ artworkId, run, facts }) =>
        facts ? [{ artworkId, run, facts }] : [],
      );
    },
  };
}
