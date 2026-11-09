import type { Database } from "@auction/db";
import { shopArtwork, shopEdition, shopEditionFacts, shopPrintException } from "@auction/db/schema";
import {
  type EditionFacts,
  type EditionRunSpec,
  type PrintException,
  type ProofsKept,
  type SetApartPrint,
  ShopDomainError,
  setApartPrintFor,
} from "@auction/shop-domain";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { factsFromColumns } from "./edition-facts-columns.js";
import { proofsKeptFromColumns, runFromColumns } from "./edition-run-columns.js";
import { exceptionFromColumns } from "./print-exception-columns.js";

type Executor = Pick<Database, "select">;
type ArtworkRow = typeof shopArtwork.$inferSelect;

/**
 * A listing of one print sold on its own, read the way a shopper meets it: the run the print
 * came from, that run's facts (with the signature the print carries), which print it is and what
 * differs. Wording is always written from this, so a change to the run reaches the listing.
 */
export type ResolvedSetApart = {
  /** The run the print belongs to, for wording ("Limited edition of 30"). */
  run: EditionRunSpec;
  proofsKept: ProofsKept | null;
  facts: EditionFacts | null;
  print: SetApartPrint;
  exception: PrintException;
  /** The run the print came from. */
  runArtworkId: string;
};

/** The artwork rows that are listings of a print sold on its own. */
export function isSetApartRow(row: Pick<ArtworkRow, "runRole">): boolean {
  return row.runRole === "set_apart";
}

/**
 * Reads the origin of each set-apart listing among `rows`. A listing whose record is returned or
 * whose run no longer reads is left out, so a caller treats it as it would any unreadable run.
 */
export async function resolveSetApartListings(
  db: Executor,
  rows: readonly ArtworkRow[],
): Promise<Map<string, ResolvedSetApart>> {
  const listings = rows.filter(isSetApartRow);
  const resolved = new Map<string, ResolvedSetApart>();
  if (listings.length === 0) return resolved;
  const records = await db
    .select({ exception: shopPrintException, edition: shopEdition })
    .from(shopPrintException)
    .innerJoin(shopEdition, eq(shopEdition.id, shopPrintException.editionId))
    .where(
      and(
        inArray(
          shopPrintException.listingArtworkId,
          listings.map((row) => row.id),
        ),
        isNull(shopPrintException.returnedAt),
      ),
    );
  const runIds = [...new Set(records.map(({ exception }) => exception.runArtworkId))];
  if (runIds.length === 0) return resolved;
  const runs = await db.select().from(shopArtwork).where(inArray(shopArtwork.id, runIds));
  const mainIds = [
    ...new Set(runs.flatMap((row) => (row.mainRunArtworkId ? [row.mainRunArtworkId] : []))),
  ];
  const mains =
    mainIds.length === 0
      ? []
      : await db.select().from(shopArtwork).where(inArray(shopArtwork.id, mainIds));
  const factsRows = await db
    .select()
    .from(shopEditionFacts)
    .where(inArray(shopEditionFacts.artworkId, runIds));
  const runById = new Map(runs.map((row) => [row.id, row]));
  const mainById = new Map(mains.map((row) => [row.id, row]));
  const factsById = new Map(factsRows.map((row) => [row.artworkId, row]));
  for (const { exception, edition } of records) {
    const runRow = runById.get(exception.runArtworkId);
    if (!runRow) continue;
    try {
      const main = runRow.mainRunArtworkId ? mainById.get(runRow.mainRunArtworkId) : undefined;
      const stored = runFromColumns(runRow, main ? proofsKeptFromColumns(main) : null);
      if (!stored) continue;
      const print = setApartPrintFor(stored.spec, edition);
      if (!print) continue;
      const differences = exceptionFromColumns(exception);
      const factsRow = factsById.get(runRow.id);
      const runFacts = factsRow ? factsFromColumns(factsRow) : null;
      resolved.set(exception.listingArtworkId, {
        run: stored.spec,
        proofsKept: stored.proofsKept,
        facts: runFacts
          ? { ...runFacts, signature: differences.signature ?? runFacts.signature }
          : null,
        print,
        exception: differences,
        runArtworkId: runRow.id,
      });
    } catch (error) {
      if (!(error instanceof ShopDomainError)) throw error;
    }
  }
  return resolved;
}
