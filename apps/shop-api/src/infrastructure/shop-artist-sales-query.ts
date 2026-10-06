import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopThirdPartySale,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const PAID_ORDER_STATUSES = ["paid", "partially_refunded"] as const;

export type ShopArtistSaleRow = {
  saleId: string;
  channel: "shop_order" | "third_party";
  artworkTitle: string;
  editionNumber: number | null;
  grossPence: number;
  payeeDisplayName: string | null;
  occurredAt: string | null;
};

export async function listArtistSalesForArtworkIds(
  db: Database,
  artworkIds: string[],
  limit: number,
): Promise<ShopArtistSaleRow[]> {
  if (artworkIds.length === 0) {
    return [];
  }

  const orderLineSales = await db
    .select({
      saleId: shopOrderLine.id,
      artworkTitle: shopArtwork.title,
      editionNumber: shopOrderLine.editionNumber,
      grossPence: shopOrderLine.unitPricePence,
      payeeDisplayName: shopParty.displayName,
      paidAt: shopOrder.paidAt,
    })
    .from(shopOrderLine)
    .innerJoin(shopOrder, eq(shopOrderLine.orderId, shopOrder.id))
    .innerJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
    .leftJoin(shopParty, eq(shopOrderLine.sellerPartyId, shopParty.id))
    .where(
      and(inArray(shopArtwork.id, artworkIds), inArray(shopOrder.status, [...PAID_ORDER_STATUSES])),
    );

  const thirdPartyRows = await db
    .select({
      saleId: shopThirdPartySale.id,
      artworkTitle: shopArtwork.title,
      editionNumber: shopEdition.editionNumber,
      grossPence: shopThirdPartySale.grossPence,
      payeeDisplayName: shopParty.displayName,
      recordedAt: shopThirdPartySale.recordedAt,
    })
    .from(shopThirdPartySale)
    .innerJoin(shopEdition, eq(shopThirdPartySale.editionId, shopEdition.id))
    .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
    .leftJoin(shopParty, eq(shopThirdPartySale.sellerPartyId, shopParty.id))
    .where(and(inArray(shopArtwork.id, artworkIds), eq(shopThirdPartySale.status, "recorded")));

  const merged: ShopArtistSaleRow[] = [
    ...orderLineSales.map((row) => ({
      saleId: row.saleId,
      channel: "shop_order" as const,
      artworkTitle: row.artworkTitle,
      editionNumber: row.editionNumber,
      grossPence: row.grossPence,
      payeeDisplayName: row.payeeDisplayName,
      occurredAt: row.paidAt ? row.paidAt.toISOString() : null,
    })),
    ...thirdPartyRows.map((row) => ({
      saleId: row.saleId,
      channel: "third_party" as const,
      artworkTitle: row.artworkTitle,
      editionNumber: row.editionNumber,
      grossPence: row.grossPence,
      payeeDisplayName: row.payeeDisplayName,
      occurredAt: row.recordedAt ? row.recordedAt.toISOString() : null,
    })),
  ];

  merged.sort((a, b) => {
    const aMs = a.occurredAt ? Date.parse(a.occurredAt) : 0;
    const bMs = b.occurredAt ? Date.parse(b.occurredAt) : 0;
    return bMs - aMs;
  });

  return merged.slice(0, limit);
}
