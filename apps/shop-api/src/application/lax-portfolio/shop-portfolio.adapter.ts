import type {
  LaxBusinessV1,
  LaxCostLineV1,
  LaxMoneyEntryV1,
  LaxPortfolioActionV1,
  LaxPortfolioDocumentV1,
  LaxPortfolioItemV1,
} from "@auction/lax-ecosystem";
import type {
  PortalPortfolioFacts,
  PortfolioChannel,
  PortfolioEditionFact,
  PortfolioOriginalFact,
  PortfolioPendingOrderLineFact,
  PortfolioSaleFact,
  PortfolioWork,
} from "../ports/portal-portfolio.reader.js";

/**
 * Maps Shop and lax.art records onto the shared portfolio contract. Pure: image URLs, origins
 * and the legal name arrive through the context, so what each status and money direction
 * means is decided here and nowhere else.
 *
 * Channel is recorded on the transaction that matters: the order for a bought edition, the
 * original sale for an original, the artwork for a work with no purchase. The channel picks
 * both the contract `product` and the site that links point at.
 */
export type ShopPortfolioContext = {
  shopOrigin: string;
  /** lax.art origin; falls back to the Shop origin when lax.art is not configured. */
  artOrigin: string;
  legalName: string;
  imageUrl(key: string | null): string | null;
};

const CURRENCY = "GBP";

/** Order states in which the buyer has paid, fully or in part. */
const PAID_ORDER_STATUSES: ReadonlySet<string> = new Set([
  "paid",
  "partially_refunded",
  "refunded",
]);

/** Fulfilment states before the work is with the owner. */
const IN_FULFILMENT: ReadonlySet<string> = new Set([
  "pending_production",
  "in_production",
  "awaiting_dispatch",
  "in_transit",
  "ready_for_collection",
]);

/** Listing states in which the owner has put the edition up for sale. */
const OFFERED_FOR_SALE: ReadonlySet<string> = new Set(["authorised", "reserved", "held"]);

function businessOf(ctx: ShopPortfolioContext): LaxBusinessV1 {
  return { key: "lax_art", legalName: ctx.legalName };
}

function originOf(ctx: ShopPortfolioContext, channel: PortfolioChannel): string {
  return channel === "art" ? ctx.artOrigin : ctx.shopOrigin;
}

function artworkHref(ctx: ShopPortfolioContext, work: PortfolioWork): string {
  return `${originOf(ctx, work.channel)}/artworks/${work.slug}`;
}

/** lax.art has no order pages; its orders are reached through the collection. */
function orderHref(ctx: ShopPortfolioContext, channel: PortfolioChannel, orderId: string): string {
  return channel === "art"
    ? `${ctx.artOrigin}/account/collection`
    : `${ctx.shopOrigin}/account/orders/${orderId}`;
}

function collectionHref(ctx: ShopPortfolioContext, channel: PortfolioChannel): string {
  return `${originOf(ctx, channel)}/account/collection`;
}

function payoutsHref(ctx: ShopPortfolioContext, channel: PortfolioChannel): string {
  return `${originOf(ctx, channel)}/account/payouts`;
}

function certificateDocument(
  fact: PortfolioEditionFact,
  channel: PortfolioChannel,
  ctx: ShopPortfolioContext,
): LaxPortfolioDocumentV1[] {
  if (fact.certificate === "issued") {
    const href =
      channel === "art"
        ? collectionHref(ctx, channel)
        : `${originOf(ctx, channel)}/account/documents`;
    return [{ kind: "certificate", available: true, href }];
  }
  if (fact.certificate === "expected") {
    return [
      {
        kind: "certificate",
        available: false,
        expectedNote: "Your certificate appears here once it has been issued.",
      },
    ];
  }
  return [];
}

function editionStatus(fact: PortfolioEditionFact): LaxPortfolioItemV1["status"] | null {
  if (OFFERED_FOR_SALE.has(fact.listingStatus)) return "in_sale";
  const { purchase } = fact;
  if (!purchase) return "owned";
  // A refunded or unpaid order is not a holding; the money still shows in the ledger.
  if (purchase.orderStatus !== "paid" && purchase.orderStatus !== "partially_refunded") {
    return null;
  }
  return purchase.fulfilmentStatus !== null && IN_FULFILMENT.has(purchase.fulfilmentStatus)
    ? "awaiting_shipment"
    : "owned";
}

function editionItem(
  fact: PortfolioEditionFact,
  ctx: ShopPortfolioContext,
): LaxPortfolioItemV1 | null {
  const status = editionStatus(fact);
  if (!status) return null;
  const { work, purchase } = fact;
  const channel = purchase?.channel ?? work.channel;

  const lines: LaxCostLineV1[] = [];
  if (purchase) {
    lines.push({ kind: "price", amount: purchase.unitPricePence, currency: CURRENCY });
    if (purchase.shippingPence > 0) {
      lines.push({ kind: "shipping", amount: purchase.shippingPence, currency: CURRENCY });
    }
  }

  const actions: LaxPortfolioActionV1[] = [];
  if (status === "awaiting_shipment" && purchase) {
    actions.push({ kind: "track_shipping", href: orderHref(ctx, channel, purchase.orderId) });
  }
  // Only Shop has the sale-limits page that lets an owner offer an edition for resale.
  if (status === "owned" && channel === "shop") {
    actions.push({ kind: "resell", href: `${ctx.shopOrigin}/account/sale-limits` });
  }
  actions.push({ kind: "view", href: artworkHref(ctx, work) });

  return {
    product: channel,
    id: fact.editionId,
    title: work.title,
    artist: work.artistName,
    image: ctx.imageUrl(work.imageKey),
    acquiredAt: (purchase?.paidAt ?? fact.createdAt).toISOString(),
    status,
    paid: { lines },
    documents: certificateDocument(fact, channel, ctx),
    actions,
    business: businessOf(ctx),
  };
}

function originalStatus(fact: PortfolioOriginalFact): LaxPortfolioItemV1["status"] {
  if (fact.status === "assigned") return "owned";
  // Paid but not yet assigned: the work has been bought and is on its way to the owner.
  if (fact.status === "paid") return "awaiting_shipment";
  return "awaiting_payment";
}

function originalItem(fact: PortfolioOriginalFact, ctx: ShopPortfolioContext): LaxPortfolioItemV1 {
  const status = originalStatus(fact);
  const actions: LaxPortfolioActionV1[] = [];
  if (status === "awaiting_payment") {
    actions.push({ kind: "pay", href: collectionHref(ctx, fact.channel) });
  }
  actions.push({ kind: "view", href: artworkHref(ctx, fact.work) });
  return {
    product: fact.channel,
    id: fact.originalSaleId,
    title: fact.work.title,
    artist: fact.work.artistName,
    image: ctx.imageUrl(fact.work.imageKey),
    acquiredAt: fact.updatedAt.toISOString(),
    status,
    paid: { lines: [{ kind: "price", amount: fact.salePricePence, currency: CURRENCY }] },
    documents: [],
    actions,
    business: businessOf(ctx),
  };
}

function pendingLineItem(
  fact: PortfolioPendingOrderLineFact,
  ctx: ShopPortfolioContext,
): LaxPortfolioItemV1 {
  const lines: LaxCostLineV1[] = [
    { kind: "price", amount: fact.unitPricePence, currency: CURRENCY },
  ];
  if (fact.shippingPence > 0) {
    lines.push({ kind: "shipping", amount: fact.shippingPence, currency: CURRENCY });
  }
  return {
    product: fact.channel,
    id: fact.orderLineId,
    title: fact.work.title,
    artist: fact.work.artistName,
    image: ctx.imageUrl(fact.work.imageKey),
    acquiredAt: fact.createdAt.toISOString(),
    status: "awaiting_payment",
    paid: { lines },
    documents: [],
    actions: [
      { kind: "pay", href: orderHref(ctx, fact.channel, fact.orderId) },
      { kind: "view", href: artworkHref(ctx, fact.work) },
    ],
    business: businessOf(ctx),
  };
}

function saleItem(fact: PortfolioSaleFact, ctx: ShopPortfolioContext): LaxPortfolioItemV1 | null {
  // A cancelled payout is a sale that did not complete; without an artwork there is nothing to show.
  if (!fact.work || fact.status === "cancelled") return null;
  return {
    product: fact.work.channel,
    id: fact.payoutId,
    title: fact.work.title,
    artist: fact.work.artistName,
    image: ctx.imageUrl(fact.work.imageKey),
    acquiredAt: fact.createdAt.toISOString(),
    status: fact.status === "paid" ? "payout_paid" : "payout_pending",
    paid: { lines: [] },
    documents: [],
    actions: [{ kind: "view", href: artworkHref(ctx, fact.work) }],
    business: businessOf(ctx),
  };
}

/** Owned and offered editions, originals, orders awaiting payment, and sales through payout. */
export function buildShopPortfolioItems(
  facts: PortalPortfolioFacts,
  ctx: ShopPortfolioContext,
): LaxPortfolioItemV1[] {
  const compact = (items: (LaxPortfolioItemV1 | null)[]) =>
    items.filter((item): item is LaxPortfolioItemV1 => item !== null);
  return [
    ...compact(facts.editions.map((fact) => editionItem(fact, ctx))),
    ...facts.originals.map((fact) => originalItem(fact, ctx)),
    ...facts.pendingOrderLines.map((fact) => pendingLineItem(fact, ctx)),
    ...compact(facts.sales.map((fact) => saleItem(fact, ctx))),
  ];
}

function payoutStatus(status: string): LaxMoneyEntryV1["status"] {
  if (status === "paid") return "completed";
  if (status === "cancelled") return "cancelled";
  return "pending";
}

function orderEntries(
  facts: PortalPortfolioFacts,
  ctx: ShopPortfolioContext,
  now: Date,
): LaxMoneyEntryV1[] {
  const business = businessOf(ctx);
  return facts.orders.flatMap((order): LaxMoneyEntryV1[] => {
    const base = {
      id: `order:${order.orderId}`,
      business,
      amount: order.totalPence,
      currency: CURRENCY,
      href: orderHref(ctx, order.channel, order.orderId),
    };
    if (PAID_ORDER_STATUSES.has(order.status)) {
      return [
        {
          ...base,
          direction: "paid",
          status: "completed",
          occurredAt: (order.paidAt ?? order.createdAt).toISOString(),
        },
      ];
    }
    // An abandoned or expired checkout was never a debt, so only a live one is owed.
    const live = !order.checkoutExpiresAt || order.checkoutExpiresAt > now;
    if (order.status === "pending_payment" && live) {
      return [
        {
          ...base,
          direction: "owed_by_you",
          status: "pending",
          occurredAt: order.createdAt.toISOString(),
        },
      ];
    }
    return [];
  });
}

function refundEntries(facts: PortalPortfolioFacts, ctx: ShopPortfolioContext) {
  return facts.refunds.flatMap((refund): LaxMoneyEntryV1[] => {
    // A failed refund moved no money.
    if (refund.status === "failed") return [];
    return [
      {
        id: `refund:${refund.refundId}`,
        business: businessOf(ctx),
        direction: "refunded",
        status:
          refund.status === "succeeded"
            ? "completed"
            : refund.status === "cancelled"
              ? "cancelled"
              : "pending",
        amount: refund.amountPence,
        currency: CURRENCY,
        occurredAt: refund.createdAt.toISOString(),
        href: orderHref(ctx, refund.channel, refund.orderId),
      },
    ];
  });
}

function originalEntries(facts: PortalPortfolioFacts, ctx: ShopPortfolioContext) {
  return facts.originals.map(
    (original): LaxMoneyEntryV1 => ({
      id: `original:${original.originalSaleId}`,
      business: businessOf(ctx),
      direction:
        original.status === "assigned" || original.status === "paid" ? "paid" : "owed_by_you",
      status:
        original.status === "assigned" || original.status === "paid" ? "completed" : "pending",
      amount: original.salePricePence,
      currency: CURRENCY,
      occurredAt: original.updatedAt.toISOString(),
      href: collectionHref(ctx, original.channel),
    }),
  );
}

function saleEntries(facts: PortalPortfolioFacts, ctx: ShopPortfolioContext) {
  return facts.sales.flatMap((sale): LaxMoneyEntryV1[] => {
    const status = payoutStatus(sale.status);
    const base = {
      business: businessOf(ctx),
      status,
      currency: CURRENCY,
      occurredAt: (sale.paidAt ?? sale.payoutDueAt).toISOString(),
      href: payoutsHref(ctx, sale.work?.channel ?? "shop"),
    };
    const entries: LaxMoneyEntryV1[] = [
      { ...base, id: `payout:${sale.payoutId}`, direction: "owed_to_you", amount: sale.netPence },
    ];
    if (sale.deductionsPence > 0) {
      entries.push({
        ...base,
        id: `payout:${sale.payoutId}:fees`,
        direction: "fee",
        amount: sale.deductionsPence,
      });
    }
    return entries;
  });
}

/** Orders paid or awaiting payment, refunds, original-sale invoices, payouts and the fees taken. */
export function buildShopMoneyEntries(
  facts: PortalPortfolioFacts,
  ctx: ShopPortfolioContext,
  now: Date = new Date(),
): LaxMoneyEntryV1[] {
  return [
    ...orderEntries(facts, ctx, now),
    ...refundEntries(facts, ctx),
    ...originalEntries(facts, ctx),
    ...saleEntries(facts, ctx),
  ];
}
