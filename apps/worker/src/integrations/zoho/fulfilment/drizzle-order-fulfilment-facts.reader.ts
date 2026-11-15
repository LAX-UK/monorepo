import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopEditionFraming,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
} from "@auction/db/schema";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  FramingFacts,
  OrderFulfilmentFactsReader,
  PrintLineFacts,
  RunSales,
} from "./order-facts.js";

const EDITION_TYPE: Record<string, PrintLineFacts["editionType"]> = {
  limited: "Numbered",
  open: "Open",
};

/** The frame sold, read from the line's snapshot; nothing else of it is read here. */
function framingFrom(row: {
  lineId: string;
  snapshot: Record<string, unknown> | null;
  releasedAt: Date | null;
}): FramingFacts {
  const frame = row.snapshot?.frame;
  return {
    lineId: row.lineId,
    frame: typeof frame === "string" ? frame : "",
    released: row.releasedAt !== null,
  };
}

/**
 * Reads an order's prints, the frame sold with each and the fulfilment from Shop's tables through
 * the column grants the worker holds for this and nothing else. No buyer, address or price column
 * is read, nor the price in the frame snapshot.
 */
export function createDrizzleOrderFulfilmentFactsReader(db: Database): OrderFulfilmentFactsReader {
  const original = alias(shopArtwork, "original");

  return {
    async read(orderId) {
      const [order] = await db
        .select({ reference: shopOrder.reference, paidAt: shopOrder.paidAt })
        .from(shopOrder)
        .where(eq(shopOrder.id, orderId))
        .limit(1);
      if (!order) return null;

      const prints = await db
        .select({
          lineId: shopOrderLine.id,
          releasedAt: shopOrderLine.releasedAt,
          editionNumber: shopOrderLine.editionNumber,
          printLabel: shopOrderLine.printLabel,
          packConfirmedAt: shopOrderLine.packConfirmedAt,
          allocation: shopEdition.allocation,
          printsArtworkId: shopArtwork.id,
          runKind: shopArtwork.runKind,
          runSize: shopArtwork.runSize,
          mainRunArtworkId: shopArtwork.mainRunArtworkId,
          printSize: shopArtwork.printSize,
          printPaper: shopArtwork.printPaper,
          printFrame: shopArtwork.printFrame,
          originalZohoProductId: original.zohoProductId,
          framingMode: shopEditionFraming.mode,
        })
        .from(shopOrderLine)
        .innerJoin(shopEdition, eq(shopEdition.id, shopOrderLine.editionId))
        .innerJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
        .leftJoin(original, eq(original.id, shopArtwork.sourceOriginalArtworkId))
        .leftJoin(shopEditionFraming, eq(shopEditionFraming.artworkId, shopArtwork.id))
        .where(and(eq(shopOrderLine.orderId, orderId), eq(shopOrderLine.kind, "goods")))
        .orderBy(shopOrderLine.id);

      const frames = await db
        .select({
          lineId: shopOrderLine.id,
          printLineId: shopOrderLine.framingForLineId,
          snapshot: shopOrderLine.framingSnapshot,
          releasedAt: shopOrderLine.releasedAt,
        })
        .from(shopOrderLine)
        .where(and(eq(shopOrderLine.orderId, orderId), eq(shopOrderLine.kind, "framing")));

      const [fulfilment] = await db
        .select({
          status: shopFulfilment.status,
          carrier: shopFulfilment.carrier,
          trackingNumber: shopFulfilment.trackingNumber,
        })
        .from(shopFulfilment)
        .where(eq(shopFulfilment.orderId, orderId))
        .limit(1);

      return {
        orderId,
        reference: order.reference,
        paid: order.paidAt !== null,
        anyPackConfirmed: prints.some((line) => line.packConfirmedAt !== null),
        fulfilment: fulfilment ?? null,
        prints: prints.map((line): PrintLineFacts => {
          const frame = frames.find((f) => f.printLineId === line.lineId);
          return {
            lineId: line.lineId,
            released: line.releasedAt !== null,
            printsArtworkId: line.printsArtworkId,
            // A proof, companion or set-apart listing links its main run (shop_artwork_run_link_ck).
            isMainRun: line.mainRunArtworkId === null,
            originalZohoProductId: line.originalZohoProductId ?? null,
            editionType: line.runKind ? (EDITION_TYPE[line.runKind] ?? null) : null,
            runSize: line.runSize,
            printSize: line.printSize,
            printPaper: line.printPaper,
            printFrame: line.printFrame,
            framedByArtist: line.framingMode === "framed_by_artist",
            allocation: line.allocation,
            editionNumber: line.editionNumber,
            printLabel: line.printLabel,
            framing: frame ? framingFrom(frame) : null,
          };
        }),
      };
    },

    async runSales(printsArtworkId): Promise<RunSales> {
      // Proofs are listed on their own and are not part of the numbered run.
      const counts = await db
        .select({ allocation: shopEdition.allocation, prints: sql<number>`count(*)::int` })
        .from(shopOrderLine)
        .innerJoin(shopEdition, eq(shopEdition.id, shopOrderLine.editionId))
        .innerJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
        .where(
          and(
            eq(shopEdition.artworkId, printsArtworkId),
            isNull(shopEdition.proofNumber),
            isNull(shopOrderLine.releasedAt),
            isNotNull(shopOrder.paidAt),
          ),
        )
        .groupBy(shopEdition.allocation);
      const sold = (allocation: string) =>
        counts.find((entry) => entry.allocation === allocation)?.prints ?? 0;
      return {
        collector: sold("original_buyer_entitlement"),
        artist: sold("artist"),
        lax: sold("lax"),
      };
    },
  };
}
