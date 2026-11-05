import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopEditionFacts,
  shopGuestCustomer,
  shopOrder,
  shopOrderLine,
} from "@auction/db/schema";
import { LAX_STANDARD_RUN } from "@auction/shop-domain";
import { and, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  PackLine,
  PackLineStore,
  PackPrint,
  RunContext,
} from "../../application/print-fulfilment/print-fulfilment.ports.js";
import { createDrizzleEditionRunRepository } from "../drizzle-edition-run.repository.js";
import { createDrizzleEditionFactsStore } from "../edition-runs/drizzle-edition-facts.store.js";

const swappedFrom = alias(shopEdition, "swapped_from");

const lineColumns = {
  orderLineId: shopOrderLine.id,
  orderId: shopOrderLine.orderId,
  orderReference: shopOrder.reference,
  paidAt: shopOrder.paidAt,
  buyerIdentitySubjectId: shopOrder.identitySubjectId,
  buyerFallbackEmail: shopGuestCustomer.email,
  artworkId: shopEdition.artworkId,
  artworkTitle: shopArtwork.title,
  sellerPartyId: shopOrderLine.sellerPartyId,
  releasedAt: shopOrderLine.releasedAt,
  confirmedAt: shopOrderLine.packConfirmedAt,
  confirmedBy: shopOrderLine.packConfirmedBy,
  editionId: shopEdition.id,
  stockRef: shopEdition.stockRef,
  editionNumber: shopEdition.editionNumber,
  proofNumber: shopEdition.proofNumber,
  labelCode: shopEdition.labelCode,
  storageLocation: shopEdition.storageLocation,
  custodyStatus: shopEdition.custodyStatus,
  ownerPartyId: shopEdition.ownerPartyId,
  fromEditionId: swappedFrom.id,
  fromStockRef: swappedFrom.stockRef,
  fromEditionNumber: swappedFrom.editionNumber,
  fromProofNumber: swappedFrom.proofNumber,
  fromLabelCode: swappedFrom.labelCode,
  fromStorageLocation: swappedFrom.storageLocation,
  fromCustodyStatus: swappedFrom.custodyStatus,
  fromOwnerPartyId: swappedFrom.ownerPartyId,
};

function toLine(row: LineRow): PackLine {
  const print: PackPrint = {
    editionId: row.editionId,
    stockRef: row.stockRef,
    editionNumber: row.editionNumber,
    proofNumber: row.proofNumber,
    labelCode: row.labelCode,
    storageLocation: row.storageLocation,
    custodyStatus: row.custodyStatus,
    ownerPartyId: row.ownerPartyId,
  };
  return {
    orderLineId: row.orderLineId,
    orderId: row.orderId,
    orderReference: row.orderReference,
    buyerIdentitySubjectId: row.buyerIdentitySubjectId,
    buyerFallbackEmail: row.buyerFallbackEmail ?? null,
    artworkId: row.artworkId,
    artworkTitle: row.artworkTitle,
    sellerPartyId: row.sellerPartyId,
    released: row.releasedAt !== null,
    paid: row.paidAt !== null,
    confirmedAt: row.confirmedAt,
    confirmedBy: row.confirmedBy,
    swappedFrom:
      row.fromEditionId !== null
        ? {
            editionId: row.fromEditionId,
            stockRef: row.fromStockRef ?? 0,
            editionNumber: row.fromEditionNumber,
            proofNumber: row.fromProofNumber,
            labelCode: row.fromLabelCode,
            storageLocation: row.fromStorageLocation,
            custodyStatus: row.fromCustodyStatus ?? "unprinted",
            ownerPartyId: row.fromOwnerPartyId,
          }
        : null,
    print,
  };
}

function baseSelect(db: Database) {
  return db
    .select(lineColumns)
    .from(shopOrderLine)
    .innerJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
    .innerJoin(shopEdition, eq(shopEdition.id, shopOrderLine.editionId))
    .innerJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
    .leftJoin(shopGuestCustomer, eq(shopGuestCustomer.id, shopOrder.guestCustomerId))
    .leftJoin(swappedFrom, eq(swappedFrom.id, shopOrderLine.swappedFromEditionId));
}

type LineRow = Awaited<ReturnType<typeof baseSelect>>[number];

/** Reads a run's context: its spec (LAX standard when none is recorded), facts and authority. */
export async function readRunContext(db: Database, artworkId: string): Promise<RunContext> {
  const [run, facts, authority] = await Promise.all([
    createDrizzleEditionRunRepository(db).getRun(artworkId),
    createDrizzleEditionFactsStore(db).get(artworkId),
    db
      .select({
        reference: shopEditionFacts.certificateAuthorityReference,
        recordedAt: shopEditionFacts.certificateAuthorityRecordedAt,
      })
      .from(shopEditionFacts)
      .where(eq(shopEditionFacts.artworkId, artworkId))
      .limit(1),
  ]);
  const recorded = authority[0];
  return {
    run: run?.spec ?? LAX_STANDARD_RUN,
    facts: facts?.facts ?? null,
    authority:
      recorded?.reference && recorded.recordedAt
        ? { reference: recorded.reference, recordedAt: recorded.recordedAt }
        : null,
  };
}

/** The order lines packing works on, and the writes that record a confirmed print. */
export function createDrizzlePackLineStore(db: Database): PackLineStore {
  return {
    async lock(orderLineId) {
      // Lock the line itself; the joined rows are read, not changed, by packing.
      const [row] = await baseSelect(db)
        .where(eq(shopOrderLine.id, orderLineId))
        .for("update", { of: shopOrderLine })
        .limit(1);
      return row ? toLine(row) : null;
    },

    async forOrder(orderId) {
      const rows = await baseSelect(db)
        .where(and(eq(shopOrderLine.orderId, orderId), isNotNull(shopOrderLine.editionId)))
        .orderBy(shopOrderLine.createdAt, shopOrderLine.id);
      return rows.map((row) => toLine(row));
    },

    runContext: (artworkId) => readRunContext(db, artworkId),

    async confirm(input) {
      await db
        .update(shopOrderLine)
        .set({
          packConfirmedAt: input.at,
          packConfirmedBy: input.actorSubjectId,
          printLabel: input.printLabel,
        })
        .where(eq(shopOrderLine.id, input.orderLineId));
    },
  };
}

export async function readContexts(
  db: Database,
  artworkIds: readonly string[],
): Promise<Map<string, RunContext>> {
  const unique = [...new Set(artworkIds)];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await readRunContext(db, id)] as const),
  );
  return new Map(entries);
}
