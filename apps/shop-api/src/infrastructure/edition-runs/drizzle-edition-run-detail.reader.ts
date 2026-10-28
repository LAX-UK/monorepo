import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopEditionFacts,
  shopEditionStockBatch,
  shopUserProfile,
} from "@auction/db/schema";
import type { AdminEditionFacts, AdminEditionRunDetail } from "@auction/shop-contracts";
import { type EditionFacts, runLocks, summariseOpenStock } from "@auction/shop-domain";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { factsFromColumns } from "../edition-facts-columns.js";
import { proofsKeptFromColumns, runFromColumns } from "../edition-run-columns.js";
import { createDrizzleEditionFactsStore } from "./drizzle-edition-facts.store.js";
import { readRunUsage } from "./drizzle-edition-print.store.js";

type ArtworkRow = typeof shopArtwork.$inferSelect;

const AFFECTED_ORDERS_LISTED = 50;

/** The facts without who confirmed them, in the contract's shape. */
function factsOnly(facts: EditionFacts): AdminEditionFacts {
  const { certificate } = facts;
  return {
    numbering: facts.numbering,
    signature: facts.signature,
    certificate:
      certificate.kind === "none"
        ? { kind: "none" }
        : {
            kind: "included",
            issuer: certificate.issuer,
            form: certificate.form,
            arrives: certificate.arrives,
            numberedToMatch: certificate.numberedToMatch,
            ...(certificate.numberedToMatchReason
              ? { numberedToMatchReason: certificate.numberedToMatchReason }
              : {}),
          },
  };
}

async function loadRow(db: Database, artworkId: string): Promise<ArtworkRow | null> {
  const [row] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, artworkId)).limit(1);
  return row ?? null;
}

/** A run in the shape LAX Admin reads; a stored run that breaks the rules reads as null. */
function specOf(row: ArtworkRow, main: ArtworkRow | null) {
  return runFromColumns(row, main ? proofsKeptFromColumns(main) : null);
}

async function readStock(db: Database, artworkId: string) {
  const [prints, batches, [next]] = await Promise.all([
    db
      .select({
        listingStatus: shopEdition.listingStatus,
        custodyStatus: shopEdition.custodyStatus,
      })
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, artworkId)),
    db
      .select({ batch: shopEditionStockBatch, addedByName: shopUserProfile.name })
      .from(shopEditionStockBatch)
      .leftJoin(
        shopUserProfile,
        eq(shopUserProfile.identitySubjectId, shopEditionStockBatch.addedBySubjectId),
      )
      .where(eq(shopEditionStockBatch.artworkId, artworkId))
      .orderBy(sql`${shopEditionStockBatch.firstStockRef} desc`),
    db
      .select({ last: sql<number>`coalesce(max(${shopEdition.stockRef}), 0)::int` })
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, artworkId)),
  ]);
  return {
    ...summariseOpenStock(prints),
    nextStockRef: Number(next?.last ?? 0) + 1,
    batches: batches.map(({ batch, addedByName }) => ({
      batchId: batch.id,
      createdAt: batch.createdAt.toISOString(),
      firstStockRef: batch.firstStockRef,
      quantity: batch.quantity,
      artistCount: batch.artistCount,
      laxCount: batch.laxCount,
      custody: batch.custodyStatus === "stored" ? ("stored" as const) : ("unprinted" as const),
      storageLocation: batch.storageLocation,
      addedByName: addedByName?.trim() || null,
    })),
  };
}

/**
 * Everything the editor shows about a run: its shape and locks, the facts with who confirmed
 * them, the orders a correction would affect, the run it belongs to or its linked listings, and
 * open edition stock. Null for an original.
 */
export async function readEditionRunDetail(
  db: Database,
  artwork: ArtworkRow,
): Promise<AdminEditionRunDetail | null> {
  if (artwork.runKind === null) return null;
  const main = artwork.mainRunArtworkId ? await loadRow(db, artwork.mainRunArtworkId) : null;
  const stored = specOf(artwork, main);
  if (!stored) return null;
  const factsStore = createDrizzleEditionFactsStore(db);
  const [usage, factsRow, orders, linkedRows] = await Promise.all([
    readRunUsage(db, artwork.id),
    db
      .select({ facts: shopEditionFacts, confirmedByName: shopUserProfile.name })
      .from(shopEditionFacts)
      .leftJoin(
        shopUserProfile,
        eq(shopUserProfile.identitySubjectId, shopEditionFacts.confirmedBySubjectId),
      )
      .where(eq(shopEditionFacts.artworkId, artwork.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    factsStore.paidOrders(artwork.id),
    db
      .select()
      .from(shopArtwork)
      .where(and(eq(shopArtwork.mainRunArtworkId, artwork.id), isNull(shopArtwork.archivedAt)))
      .orderBy(asc(shopArtwork.createdAt)),
  ]);
  const facts = factsRow ? factsFromColumns(factsRow.facts) : null;
  const mainStored = main ? specOf(main, null) : null;
  const isOpen =
    stored.spec.type === "open" ||
    (stored.spec.type === "companion" && stored.spec.run.type === "open");
  return {
    spec: stored.spec,
    proofsKept: stored.proofsKept,
    locks: runLocks(usage),
    facts: facts ? factsOnly(facts) : null,
    factsConfirmed: facts?.confirmed
      ? {
          byName: factsRow?.confirmedByName?.trim() || null,
          at: facts.confirmed.at.toISOString(),
        }
      : null,
    factsVersion: factsRow ? factsRow.facts.updatedAt.toISOString() : null,
    paidOrderCount: usage.paidOrders,
    affectedOrders: orders.slice(0, AFFECTED_ORDERS_LISTED).map((order) => ({
      orderId: order.orderId,
      reference: order.reference,
      paidAt: order.paidAt?.toISOString() ?? null,
    })),
    mainRun:
      main && mainStored ? { artworkId: main.id, title: main.title, spec: mainStored.spec } : null,
    linkedListings: linkedRows.flatMap((row) => {
      const linked = specOf(row, artwork);
      return linked ? [{ artworkId: row.id, title: row.title, spec: linked.spec }] : [];
    }),
    stock: isOpen ? await readStock(db, artwork.id) : null,
  };
}
