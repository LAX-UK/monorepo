import type { Database } from "@auction/db";
import { shopArtwork, shopEditionFacts } from "@auction/db/schema";
import {
  type EditionFactsSnapshot,
  ShopDomainError,
  createEditionSnapshot,
} from "@auction/shop-domain";
import { inArray } from "drizzle-orm";
import { factsFromColumns } from "./edition-facts-columns.js";
import { proofsKeptFromColumns, runFromColumns } from "./edition-run-columns.js";
import { resolveSetApartListings } from "./set-apart-source.js";

type Executor = Pick<Database, "select">;
type ArtworkRow = typeof shopArtwork.$inferSelect;

async function loadArtworks(db: Executor, ids: readonly string[]): Promise<ArtworkRow[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(shopArtwork)
    .where(inArray(shopArtwork.id, [...ids]));
}

/**
 * The run and confirmed facts of each artwork as they stand now, in the shape stored on an order
 * line. An original, or a run whose stored data is not valid, has no entry: there is nothing to
 * tell a buyer about it, and the caller falls back to the plain edition number.
 */
export async function liveEditionSnapshots(
  db: Executor,
  artworkIds: readonly string[],
): Promise<Map<string, EditionFactsSnapshot>> {
  const unique = [...new Set(artworkIds)];
  const artworks = await loadArtworks(db, unique);
  const mainIds = artworks.flatMap((row) => (row.mainRunArtworkId ? [row.mainRunArtworkId] : []));
  const [mains, factsRows] = await Promise.all([
    loadArtworks(db, [...new Set(mainIds)]),
    unique.length === 0
      ? []
      : db.select().from(shopEditionFacts).where(inArray(shopEditionFacts.artworkId, unique)),
  ]);
  const mainById = new Map(mains.map((row) => [row.id, row]));
  const factsById = new Map(factsRows.map((row) => [row.artworkId, row]));

  const apart = await resolveSetApartListings(db, artworks);
  const snapshots = new Map<string, EditionFactsSnapshot>();
  for (const artwork of artworks) {
    if (artwork.runRole === "set_apart") {
      // A print sold on its own is described as its run, with what differs kept on the order.
      const origin = apart.get(artwork.id);
      if (origin) {
        snapshots.set(
          artwork.id,
          createEditionSnapshot({
            run: origin.run,
            proofsKept: origin.proofsKept,
            facts: origin.facts,
            exception: origin.exception,
          }),
        );
      }
      continue;
    }
    const main = artwork.mainRunArtworkId ? mainById.get(artwork.mainRunArtworkId) : undefined;
    try {
      const run = runFromColumns(artwork, main ? proofsKeptFromColumns(main) : null);
      if (!run) continue;
      const facts = factsById.get(artwork.id);
      snapshots.set(
        artwork.id,
        createEditionSnapshot({
          run: run.spec,
          proofsKept: run.proofsKept,
          facts: facts ? factsFromColumns(facts) : null,
        }),
      );
    } catch (error) {
      if (!(error instanceof ShopDomainError)) throw error;
    }
  }
  return snapshots;
}
