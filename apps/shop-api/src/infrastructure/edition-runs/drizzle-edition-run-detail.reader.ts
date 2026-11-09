import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopEditionFacts,
  shopEditionStockBatch,
  shopOrder,
  shopPrintException,
  shopUserProfile,
} from "@auction/db/schema";
import type {
  AdminEditionFacts,
  AdminEditionRunDetail,
  AdminPrintBlock,
  AdminRunPrint,
  AdminSetApartInfo,
} from "@auction/shop-contracts";
import {
  type EditionFacts,
  type EditionListingStatus,
  type EditionRunSpec,
  type SetApartBlock,
  describePrintException,
  returnBlock,
  runLocks,
  setApartBlock,
  setApartPrintFor,
  setApartPrintOf,
  summariseOpenStock,
} from "@auction/shop-domain";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { factsFromColumns } from "../edition-facts-columns.js";
import { proofsKeptFromColumns, runFromColumns } from "../edition-run-columns.js";
import { exceptionFromColumns } from "../print-exception-columns.js";
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
            ...(certificate.authority?.datedOn && certificate.authority.reference
              ? {
                  authority: {
                    givenBy: certificate.authority.givenBy,
                    datedOn: certificate.authority.datedOn,
                    reference: certificate.authority.reference,
                  },
                }
              : {}),
          },
    ...(facts.stamp && facts.stamp !== "none" ? { stamp: facts.stamp } : {}),
    ...(facts.printedBy ? { printedBy: facts.printedBy } : {}),
    ...(facts.publishedBy ? { publishedBy: facts.publishedBy } : {}),
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

function blockOf(block: SetApartBlock | null): AdminPrintBlock | null {
  if (!block) return null;
  return {
    kind: block.kind,
    until: block.kind === "in_basket" ? (block.until?.toISOString() ?? null) : null,
  };
}

type PrintRow = {
  editionId: string;
  editionNumber: number | null;
  proofNumber: number | null;
  stockRef: number;
  allocation: "original_buyer_entitlement" | "artist" | "lax";
  ownerPartyId: string | null;
  custodyStatus: string;
  listingStatus: EditionListingStatus;
  reservedUntil: Date | null;
  pendingOrder: boolean;
};

function printLabelOf(row: PrintRow, run: EditionRunSpec): string {
  const identity = setApartPrintFor(run, row);
  if (!identity) return String(row.stockRef);
  return identity.of.kind === "proof"
    ? `${identity.of.label} ${identity.proofNumber ?? row.stockRef}`
    : String(identity.editionNumber ?? row.stockRef);
}

function statusOf(row: PrintRow, now: Date): AdminRunPrint["status"] {
  switch (row.listingStatus) {
    case "authorised":
      return "on_sale";
    case "sold":
      return "sold";
    case "held":
      return "held";
    case "withdrawn":
      return "withdrawn";
    case "not_authorised":
      return "not_on_sale";
    case "reserved":
      return row.pendingOrder || (row.reservedUntil !== null && row.reservedUntil >= now)
        ? "in_basket"
        : "on_sale";
  }
}

const printColumns = {
  editionId: shopEdition.id,
  editionNumber: shopEdition.editionNumber,
  proofNumber: shopEdition.proofNumber,
  stockRef: shopEdition.stockRef,
  allocation: shopEdition.allocation,
  ownerPartyId: shopEdition.ownerPartyId,
  custodyStatus: shopEdition.custodyStatus,
  listingStatus: shopEdition.listingStatus,
  reservedUntil: shopEdition.reservedUntil,
  pendingOrder: sql<boolean>`exists (
    select 1 from ${shopOrder}
    where ${shopOrder.id} = ${shopEdition.reservedByOrderId}
      and ${shopOrder.status} = 'pending_payment'
  )`,
};

/** Each print of a numbered run or proof listing, with what stops it being set apart. */
async function readRunPrints(
  db: Database,
  artwork: ArtworkRow,
  spec: EditionRunSpec,
  now: Date,
): Promise<AdminRunPrint[]> {
  const [own, apart] = await Promise.all([
    db
      .select(printColumns)
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, artwork.id))
      .orderBy(asc(shopEdition.stockRef)),
    db
      .select({
        exception: shopPrintException,
        listingTitle: shopArtwork.title,
        ...printColumns,
      })
      .from(shopPrintException)
      .innerJoin(shopEdition, eq(shopEdition.id, shopPrintException.editionId))
      .innerJoin(shopArtwork, eq(shopArtwork.id, shopPrintException.listingArtworkId))
      .where(
        and(eq(shopPrintException.runArtworkId, artwork.id), isNull(shopPrintException.returnedAt)),
      ),
  ]);
  const rows: AdminRunPrint[] = own.map((row) => {
    const forSale =
      row.ownerPartyId !== null &&
      row.allocation !== "original_buyer_entitlement" &&
      row.custodyStatus !== "with_owner" &&
      row.custodyStatus !== "returned";
    return {
      editionId: row.editionId,
      label: printLabelOf(row, spec),
      owner: row.allocation === "original_buyer_entitlement" ? "buyer" : row.allocation,
      status: statusOf(row, now),
      block: blockOf(
        setApartBlock(
          {
            listingStatus: row.listingStatus,
            reservedUntil: row.reservedUntil,
            reservedByPendingOrder: row.pendingOrder,
            forSale,
            alreadySetApart: false,
          },
          now,
        ),
      ),
      setApart: null,
    };
  });
  for (const row of apart) {
    rows.push({
      editionId: row.editionId,
      label: printLabelOf(row, spec),
      owner: row.allocation === "original_buyer_entitlement" ? "buyer" : row.allocation,
      status: "set_apart",
      block: { kind: "already_apart", until: null },
      setApart: {
        listingArtworkId: row.exception.listingArtworkId,
        title: row.listingTitle,
        differences: describePrintException(exceptionFromColumns(row.exception)).rows,
      },
    });
  }
  const order = (row: AdminRunPrint) => Number.parseInt(row.label.replace(/\D+/g, ""), 10) || 0;
  return rows.sort((a, b) => order(a) - order(b));
}

/** For a listing of one print sold on its own: where it came from and whether it can go back. */
async function readSetApartInfo(
  db: Database,
  listing: ArtworkRow,
  now: Date,
): Promise<AdminSetApartInfo | null> {
  const [record] = await db
    .select({ exception: shopPrintException, runTitle: shopArtwork.title, ...printColumns })
    .from(shopPrintException)
    .innerJoin(shopEdition, eq(shopEdition.id, shopPrintException.editionId))
    .innerJoin(shopArtwork, eq(shopArtwork.id, shopPrintException.runArtworkId))
    .where(
      and(
        eq(shopPrintException.listingArtworkId, listing.id),
        isNull(shopPrintException.returnedAt),
      ),
    )
    .limit(1);
  if (!record) return null;
  const run = await loadRow(db, record.exception.runArtworkId);
  const runMain = run?.mainRunArtworkId ? await loadRow(db, run.mainRunArtworkId) : null;
  const stored = run ? specOf(run, runMain) : null;
  if (!stored) return null;
  const identity = setApartPrintFor(stored.spec, record);
  if (!identity) return null;
  return {
    runArtworkId: record.exception.runArtworkId,
    runTitle: record.runTitle,
    label: printLabelOf(record, stored.spec),
    printOf: setApartPrintOf(identity),
    differences: describePrintException(exceptionFromColumns(record.exception)).rows,
    returnBlock: blockOf(
      returnBlock(
        {
          listingStatus: record.listingStatus,
          reservedUntil: record.reservedUntil,
          reservedByPendingOrder: record.pendingOrder,
        },
        now,
      ),
    ),
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
    prints:
      !isOpen && stored.spec.type !== "set_apart"
        ? await readRunPrints(db, artwork, stored.spec, new Date())
        : null,
    setApart:
      stored.spec.type === "set_apart" ? await readSetApartInfo(db, artwork, new Date()) : null,
    certificateAuthority:
      factsRow?.facts.certificateAuthorityReference && factsRow.facts.certificateAuthorityRecordedAt
        ? {
            reference: factsRow.facts.certificateAuthorityReference,
            recordedAt: factsRow.facts.certificateAuthorityRecordedAt.toISOString(),
          }
        : null,
    horsCommerce:
      artwork.proofType === "hc"
        ? { approvedAt: artwork.horsCommerceApprovedAt?.toISOString() ?? null }
        : null,
  };
}
