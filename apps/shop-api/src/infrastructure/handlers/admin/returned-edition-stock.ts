import type { Database } from "@auction/db";
import { shopEdition, shopOrder, shopOrderLine } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type ShopReturnDisposition, listingAfterReturn } from "@auction/shop-domain";
import { and, eq, isNull, ne } from "drizzle-orm";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { resolveListingStatusAfterReservationRelease } from "../../shop-edition-listing-on-release.js";

export type ReturnedEditionStockInput = {
  editionId: string;
  orderId: string;
  orderLineId: string;
  /** The party that sold the print on this line; it owns the print again. */
  sellerPartyId: string;
  disposition: ShopReturnDisposition;
  now: Date;
};

export type ReturnedEditionStockResult = {
  /** Whether a customer can buy the print again now. */
  onSale: boolean;
  listingStatus: "authorised" | "not_authorised" | "withdrawn";
};

function conflict(message: string): never {
  throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);
}

/**
 * Puts a print that is back in the gallery into stock again, or withdraws it. It refuses when the
 * print is no longer the one this order sold: already restocked, sold to someone else, held by a
 * checkout that is open now, or numbered differently from the order line. The print keeps its
 * own number, so numbering is never reassigned.
 */
export async function applyReturnedEditionStock(
  db: Database,
  input: ReturnedEditionStockInput,
): Promise<ReturnedEditionStockResult> {
  const [edition] = await db
    .select({
      id: shopEdition.id,
      artworkId: shopEdition.artworkId,
      editionNumber: shopEdition.editionNumber,
      listingStatus: shopEdition.listingStatus,
      ownerPartyId: shopEdition.ownerPartyId,
      reservedByOrderId: shopEdition.reservedByOrderId,
    })
    .from(shopEdition)
    .where(eq(shopEdition.id, input.editionId))
    .for("update")
    .limit(1);
  if (!edition) throw notFound("Edition");

  const [line] = await db
    .select({ editionNumber: shopOrderLine.editionNumber })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.id, input.orderLineId))
    .limit(1);
  const [order] = await db
    .select({ buyerPartyId: shopOrder.buyerPartyId })
    .from(shopOrder)
    .where(eq(shopOrder.id, input.orderId))
    .limit(1);
  if (!line || !order) throw notFound("Order line");

  if (edition.listingStatus !== "sold") {
    conflict("This print is no longer marked as sold, so it cannot be put back on sale");
  }
  if (order.buyerPartyId && edition.ownerPartyId !== order.buyerPartyId) {
    conflict("This print now belongs to someone else");
  }
  if (line.editionNumber !== null && line.editionNumber !== edition.editionNumber) {
    conflict("The print's number no longer matches the order line");
  }
  if (edition.reservedByOrderId) {
    conflict("A checkout is holding this print");
  }
  const [openCheckout] = await db
    .select({ orderId: shopOrderLine.orderId })
    .from(shopOrderLine)
    .innerJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
    .where(
      and(
        eq(shopOrderLine.editionId, input.editionId),
        ne(shopOrderLine.orderId, input.orderId),
        isNull(shopOrderLine.releasedAt),
        eq(shopOrder.status, "pending_payment"),
      ),
    )
    .limit(1);
  if (openCheckout) conflict("Another checkout is open for this print");

  // The cancelled line no longer holds the print; without this the next buyer's order line would
  // collide with it.
  await db
    .update(shopOrderLine)
    .set({ releasedAt: input.now })
    .where(and(eq(shopOrderLine.id, input.orderLineId), isNull(shopOrderLine.releasedAt)));

  const intended = listingAfterReturn(input.disposition);
  if (intended === "withdrawn") {
    await db
      .update(shopEdition)
      .set({
        listingStatus: "withdrawn",
        ownerPartyId: input.sellerPartyId,
        custodyStatus: "returned",
        withdrawnReason: "Returned damaged",
        saleAuthorisedAt: null,
        reservedUntil: null,
        reservedByOrderId: null,
      })
      .where(eq(shopEdition.id, input.editionId));
    return { onSale: false, listingStatus: "withdrawn" };
  }

  // Sale authority still decides: if the grant was reduced while the print was away, it returns
  // to its owner's stock but not to sale.
  const listingStatus = await resolveListingStatusAfterReservationRelease(db, {
    artworkId: edition.artworkId,
    ownerPartyId: input.sellerPartyId,
  });
  await db
    .update(shopEdition)
    .set({
      listingStatus,
      ownerPartyId: input.sellerPartyId,
      custodyStatus: "stored",
      withdrawnReason: null,
      saleAuthorisedAt: listingStatus === "authorised" ? input.now : null,
      reservedUntil: null,
      reservedByOrderId: null,
    })
    .where(eq(shopEdition.id, input.editionId));
  return { onSale: listingStatus === "authorised", listingStatus };
}
