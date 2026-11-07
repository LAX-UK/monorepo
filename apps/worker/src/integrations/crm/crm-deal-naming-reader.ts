import type { Database } from "@auction/db";
import {
  artworkRegister,
  bidIdentityDirectory,
  shopGuestCustomer,
  shopOrder,
  shopOrderLine,
  shopUserProfile,
} from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";

/**
 * What a deal name needs beyond the event: who the client is and which work the deal is about.
 * Names come from LAX's own profiles and are used as the surname in the deal name; an email
 * address is never a client name.
 */
export type CrmDealNamingFacts = {
  /** The client's full name; the formatter takes the surname. Null when LAX holds none. */
  clientName: string | null;
  /** The register stock code of the work, when it has one. */
  stockCode: string | null;
  /** Whether the work is an original or a print, from the register; null when unknown. */
  artworkKind: "original" | "print" | null;
  /** Further order lines beyond the one named. */
  additionalWorks: number;
  /** LAX's own reference for the sale (the shop order reference); null when it has none. */
  reference: string | null;
};

export interface CrmDealNamingReader {
  forLotWon(input: { lotId: string; userId: string }): Promise<CrmDealNamingFacts>;
  /** The order's first line names the deal; `lineCount` is the paid event's count of lines. */
  forShopOrder(input: {
    orderId: string;
    subjectId: string;
    lineCount: number;
  }): Promise<CrmDealNamingFacts>;
}

export function createDrizzleCrmDealNamingReader(db: Database): CrmDealNamingReader {
  async function registerEntry(kind: "bid_lot" | "shop_artwork", refId: string) {
    const [row] = await db
      .select({ stockCode: artworkRegister.stockCode, kind: artworkRegister.kind })
      .from(artworkRegister)
      .where(and(eq(artworkRegister.offerRefKind, kind), eq(artworkRegister.offerRefId, refId)))
      .limit(1);
    return row ?? null;
  }

  async function bidName(subjectId: string): Promise<string | null> {
    const [row] = await db
      .select({ name: bidIdentityDirectory.name })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, subjectId))
      .limit(1);
    return row?.name ?? null;
  }

  async function shopName(subjectId: string): Promise<string | null> {
    const [row] = await db
      .select({ name: shopUserProfile.name })
      .from(shopUserProfile)
      .where(eq(shopUserProfile.identitySubjectId, subjectId))
      .limit(1);
    return row?.name ?? (await bidName(subjectId));
  }

  const facts = (
    clientName: string | null,
    entry: { stockCode: string; kind: "original" | "print" } | null,
    additionalWorks = 0,
    reference: string | null = null,
  ): CrmDealNamingFacts => ({
    clientName,
    stockCode: entry?.stockCode ?? null,
    artworkKind: entry?.kind ?? null,
    additionalWorks,
    reference,
  });

  return {
    async forLotWon({ lotId, userId }) {
      return facts(await bidName(userId), await registerEntry("bid_lot", lotId));
    },

    async forShopOrder({ orderId, subjectId, lineCount }) {
      const [order] = await db
        .select({
          guestName: shopGuestCustomer.name,
          recipient: shopOrder.deliveryRecipientName,
          reference: shopOrder.reference,
        })
        .from(shopOrder)
        .leftJoin(shopGuestCustomer, eq(shopGuestCustomer.id, shopOrder.guestCustomerId))
        .where(eq(shopOrder.id, orderId))
        .limit(1);
      const [firstLine] = await db
        .select({ artworkId: shopOrderLine.artworkId })
        .from(shopOrderLine)
        .where(eq(shopOrderLine.orderId, orderId))
        .orderBy(asc(shopOrderLine.createdAt), asc(shopOrderLine.id))
        .limit(1);
      const entry = firstLine?.artworkId
        ? await registerEntry("shop_artwork", firstLine.artworkId)
        : null;
      const clientName =
        (subjectId.startsWith("guest:") ? null : await shopName(subjectId)) ??
        order?.guestName ??
        order?.recipient ??
        null;
      return facts(clientName, entry, Math.max(0, lineCount - 1), order?.reference ?? null);
    },
  };
}
