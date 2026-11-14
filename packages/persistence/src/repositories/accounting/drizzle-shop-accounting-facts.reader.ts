import type {
  ShopDeliveryFacts,
  ShopOrderLineFacts,
  ShopOrderPaidFacts,
  ShopRefundFacts,
} from "@auction/accounting-domain";
import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopGuestCustomer,
  shopOrder,
  shopOrderLine,
  shopProduct,
  shopProductVariant,
  shopRefund,
  shopUserProfile,
} from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type {
  FactsRead,
  IShopAccountingFactsReader,
  IShopDeliveryReader,
  IShopInvoiceEmailFactsReader,
  ShopInvoiceEmailFacts,
  ShopInvoiceRecipient,
  ShopRefundSettledRead,
} from "../../interfaces/accounting.js";

const skip = (reason: string) => ({ status: "skip", reason }) as const;
const ready = <T>(facts: T) => ({ status: "ready", facts }) as const;
const londonDay = (instant: Date) => dayKey(instant, LONDON_TIME_ZONE);

/** Statuses of an order that was paid (a refund later does not undo the sale's invoice). */
const PAID_STATUSES = new Set(["paid", "partially_refunded", "refunded"]);

/** How the order reached the buyer, as the Shop's own invoice words it. */
export const FULFILMENT_LINE: Readonly<Record<string, string>> = {
  uk_insured_delivery: "UK insured delivery",
  collect_new_cavendish: "Collection from our London gallery",
  collect_brunswick: "Collection in London",
  lax_storage: "Storage with LAX",
  international_quotation: "Delivery outside the UK",
};

/** The name a Books contact needs when the buyer gave none (or it was erased). */
const UNNAMED_BUYER = "LAX Shop customer";

const isGuestSubject = (subject: string) => subject.startsWith("guest:");

function frameName(snapshot: Record<string, unknown> | null): string | null {
  const name = snapshot?.name;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
}

/**
 * The stored Shop order rows behind the Shop accounting flow. Read-only, and only the columns the
 * worker is granted (WORKER_SHOP_INVOICE_READ_COLUMNS): never the address or the phone.
 */
export class DrizzleShopAccountingFactsReader
  implements IShopAccountingFactsReader, IShopInvoiceEmailFactsReader
{
  constructor(private readonly db: Database) {}

  async orderPaid(orderId: string): Promise<FactsRead<ShopOrderPaidFacts>> {
    const [order] = await this.db
      .select({
        id: shopOrder.id,
        status: shopOrder.status,
        invoiceNumber: shopOrder.invoiceNumber,
        identitySubjectId: shopOrder.identitySubjectId,
        guestCustomerId: shopOrder.guestCustomerId,
        buyerPartyId: shopOrder.buyerPartyId,
        fulfilment: shopOrder.fulfilment,
        surchargePence: shopOrder.fulfilmentSurchargePence,
        surchargeVatPence: shopOrder.fulfilmentVatPence,
        totalPence: shopOrder.totalPence,
        paidAt: shopOrder.paidAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, orderId));
    if (!order) return skip("order_not_found");
    if (!PAID_STATUSES.has(order.status) || !order.paidAt) return skip("order_not_paid");
    // The number and the buyer's party are set in the transaction that marks the order paid.
    if (!order.invoiceNumber || !order.buyerPartyId) return skip("order_not_invoiced");

    const rows = await this.db
      .select({
        id: shopOrderLine.id,
        kind: shopOrderLine.kind,
        printLabel: shopOrderLine.printLabel,
        editionNumber: shopOrderLine.editionNumber,
        unitPricePence: shopOrderLine.unitPricePence,
        vatTreatment: shopOrderLine.vatTreatment,
        vatPence: shopOrderLine.vatPence,
        framingSnapshot: shopOrderLine.framingSnapshot,
        artworkTitle: shopArtwork.title,
        productTitle: shopProduct.title,
        sku: shopProductVariant.sku,
      })
      .from(shopOrderLine)
      .leftJoin(shopArtwork, eq(shopArtwork.id, shopOrderLine.artworkId))
      .leftJoin(shopProductVariant, eq(shopProductVariant.id, shopOrderLine.productVariantId))
      .leftJoin(shopProduct, eq(shopProduct.id, shopProductVariant.productId))
      .where(eq(shopOrderLine.orderId, order.id))
      // The order the event names its lines in.
      .orderBy(asc(shopOrderLine.id));

    const lines: ShopOrderLineFacts[] = rows.map((row) => ({
      id: row.id.toLowerCase(),
      kind: row.kind,
      label: lineLabel(row),
      grossPence: row.unitPricePence,
      vatTreatment: row.vatTreatment,
      vatPence: row.vatPence,
    }));
    const buyer = await this.buyer(order);
    return ready({
      orderId: order.id.toLowerCase(),
      invoiceNumber: order.invoiceNumber,
      buyer: {
        partyId: order.buyerPartyId.toLowerCase(),
        name: buyer?.name?.trim() || UNNAMED_BUYER,
        email: buyer?.email ?? null,
      },
      paidOn: londonDay(order.paidAt),
      totalPence: order.totalPence,
      lines,
      delivery: {
        scope: order.fulfilment === "international_quotation" ? "outside_uk" : "uk",
        label: FULFILMENT_LINE[order.fulfilment] ?? "Delivery",
        grossPence: order.surchargePence,
        vatPence: order.surchargeVatPence,
      },
    });
  }

  async refundSettled(refundId: string): Promise<FactsRead<ShopRefundSettledRead>> {
    const [own] = await this.db
      .select({ orderId: shopRefund.orderId, status: shopRefund.status })
      .from(shopRefund)
      .where(eq(shopRefund.id, refundId));
    if (!own) return skip("refund_not_found");
    // Only a refund that went through says anything to the books; succeeded is final in the Shop.
    if (own.status !== "succeeded") return skip("refund_not_succeeded");
    const order = await this.orderPaid(own.orderId);
    if (order.status === "skip") return order;
    const rows = await this.db
      .select({
        id: shopRefund.id,
        amountPence: shopRefund.amountPence,
        orderLineId: shopRefund.orderLineId,
        settledOutsideAt: shopRefund.settledOutsideAt,
        updatedAt: shopRefund.updatedAt,
      })
      .from(shopRefund)
      .where(and(eq(shopRefund.orderId, own.orderId), eq(shopRefund.status, "succeeded")))
      .orderBy(asc(shopRefund.createdAt), asc(shopRefund.id));
    const refunds: ShopRefundFacts[] = rows.map((row) => ({
      refundId: row.id.toLowerCase(),
      amountPence: row.amountPence,
      // The row is last written when the refund goes through (or is marked settled outside).
      refundedOn: londonDay(row.settledOutsideAt ?? row.updatedAt),
      orderLineId: row.orderLineId?.toLowerCase() ?? null,
      settledOutside: row.settledOutsideAt !== null,
    }));
    return ready({ order: order.facts, refunds, refundId: refundId.toLowerCase() });
  }

  async forOrder(orderId: string): Promise<ShopInvoiceEmailFacts | null> {
    const [order] = await this.db
      .select({
        id: shopOrder.id,
        reference: shopOrder.reference,
        status: shopOrder.status,
        identitySubjectId: shopOrder.identitySubjectId,
        guestCustomerId: shopOrder.guestCustomerId,
        totalPence: shopOrder.totalPence,
        paidAt: shopOrder.paidAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, orderId));
    if (!order?.paidAt) return null;
    return {
      orderId: order.id.toLowerCase(),
      orderReference: order.reference,
      totalPence: order.totalPence,
      paidAt: order.paidAt,
      // A refund does not cancel the invoice (a credit note follows); only a cancelled order does.
      cancelled: order.status === "cancelled",
      guest: isGuestSubject(order.identitySubjectId),
      recipient: await this.buyer(order),
    };
  }

  /**
   * The order's owner now: the guest while the order is a guest's, or the LAX account that owns it
   * (after a claim, the account, never the guest it was). Null when they cannot be reached.
   */
  private async buyer(order: {
    readonly identitySubjectId: string;
    readonly guestCustomerId: string | null;
  }): Promise<ShopInvoiceRecipient | null> {
    if (isGuestSubject(order.identitySubjectId)) {
      if (!order.guestCustomerId) return null;
      const [guest] = await this.db
        .select({
          email: shopGuestCustomer.email,
          name: shopGuestCustomer.name,
          erasedAt: shopGuestCustomer.erasedAt,
        })
        .from(shopGuestCustomer)
        .where(eq(shopGuestCustomer.id, order.guestCustomerId));
      if (!guest || guest.erasedAt !== null || !guest.email) return null;
      return { email: guest.email, name: guest.name };
    }
    const [profile] = await this.db
      .select({
        email: shopUserProfile.email,
        name: shopUserProfile.name,
        disabledAt: shopUserProfile.disabledAt,
        deletionRequestedAt: shopUserProfile.deletionRequestedAt,
        mergedInto: shopUserProfile.mergedIntoSubjectId,
      })
      .from(shopUserProfile)
      .where(eq(shopUserProfile.identitySubjectId, order.identitySubjectId));
    if (
      !profile?.email ||
      profile.disabledAt !== null ||
      profile.deletionRequestedAt !== null ||
      profile.mergedInto !== null
    ) {
      return null;
    }
    return { email: profile.email, name: profile.name };
  }
}

/** What the invoice says a line is: the work and its print, the product and its SKU, or the frame. */
function lineLabel(row: {
  readonly kind: "goods" | "framing";
  readonly printLabel: string | null;
  readonly editionNumber: number | null;
  readonly framingSnapshot: Record<string, unknown> | null;
  readonly artworkTitle: string | null;
  readonly productTitle: string | null;
  readonly sku: string | null;
}): string {
  if (row.kind === "framing") {
    // The frame as it was sold: its name is frozen on the line with its price.
    return `Framing: ${frameName(row.framingSnapshot) ?? "frame"}`;
  }
  if (row.artworkTitle) {
    const print =
      row.printLabel ?? (row.editionNumber !== null ? `no. ${row.editionNumber}` : null);
    return print ? `${row.artworkTitle} · ${print}` : row.artworkTitle;
  }
  if (row.productTitle) return row.sku ? `${row.productTitle} · SKU ${row.sku}` : row.productTitle;
  return "Item";
}

/**
 * A paid Shop order's delivery as stored, for releasing its parked outside-UK delivery invoice
 * (the Bid API, where staff press Release). It reads the order row's status and delivery columns
 * only: no buyer, no address, no lines (api_app is granted exactly these columns).
 */
export class DrizzleShopDeliveryReader implements IShopDeliveryReader {
  constructor(private readonly db: Database) {}

  async delivery(orderId: string): Promise<FactsRead<ShopDeliveryFacts>> {
    const [order] = await this.db
      .select({
        status: shopOrder.status,
        fulfilment: shopOrder.fulfilment,
        surchargePence: shopOrder.fulfilmentSurchargePence,
        surchargeVatPence: shopOrder.fulfilmentVatPence,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, orderId));
    if (!order) return skip("order_not_found");
    if (!PAID_STATUSES.has(order.status)) return skip("order_not_paid");
    return ready({
      scope: order.fulfilment === "international_quotation" ? "outside_uk" : "uk",
      label: FULFILMENT_LINE[order.fulfilment] ?? "Delivery",
      grossPence: order.surchargePence,
      vatPence: order.surchargeVatPence,
    } satisfies ShopDeliveryFacts);
  }
}
