import type {
  LaxBusinessV1,
  LaxCostLineV1,
  LaxMoneyEntryV1,
  LaxPortfolioActionV1,
  LaxPortfolioDocumentV1,
  LaxPortfolioItemV1,
} from "@auction/lax-ecosystem";
import type {
  BidPaymentFact,
  BidPayoutFact,
  BidPortfolioFacts,
  BidSellerLotFact,
  BidWonLotFact,
} from "@auction/persistence/interfaces";
import { lotPath } from "@auction/types";
import { gbpAmountToPence } from "../../lib/decimal-money.js";

/**
 * Maps what Bid knows about a person's personal entity onto the shared portfolio contract.
 * Pure: every lookup (image URLs, origin, legal name) arrives through the context, so the
 * rules for what a status or a money direction means live here and nowhere else.
 */
export type BidPortfolioContext = {
  /** Public origin of the Bid web app; every `href` in the contract is absolute against it. */
  webOrigin: string;
  legalName: string;
  /** Public URL for a stored media key, or null when the work has no usable image. */
  imageUrl(key: string | null): string | null;
};

const PAYMENT_CURRENCY = "GBP";

/** Payments that still need the buyer to act. */
const UNPAID_PAYMENT_STATUSES: ReadonlySet<BidPaymentFact["status"]> = new Set([
  "pending",
  "authorized",
  "requires_manual_review",
]);

/** Fulfilment stages before the work has reached the buyer. */
const IN_FULFILMENT_STATUSES: ReadonlySet<string> = new Set([
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
]);

function businessOf(ctx: BidPortfolioContext): LaxBusinessV1 {
  return { key: "lax_bid", legalName: ctx.legalName };
}

function paymentsPage(ctx: BidPortfolioContext): string {
  return `${ctx.webOrigin}/dashboard/payments`;
}

function payoutsPage(ctx: BidPortfolioContext): string {
  return `${ctx.webOrigin}/dashboard/seller/payouts`;
}

/** Newest payment per lot; the facts arrive newest first. */
function latestPaymentByLot(payments: readonly BidPaymentFact[]): Map<string, BidPaymentFact> {
  const byLot = new Map<string, BidPaymentFact>();
  for (const payment of payments) {
    if (!byLot.has(payment.lotId)) byLot.set(payment.lotId, payment);
  }
  return byLot;
}

/**
 * Decimal major units to integer minor units, or null when the value is not a finite number.
 * The contract only accepts whole, non-negative amounts, so callers drop what cannot be one.
 */
function toPence(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const pence = gbpAmountToPence(value);
  return Number.isFinite(pence) ? pence : null;
}

/**
 * The hammer always comes from the lot, so a purchase never shows empty cost lines. The buyer's
 * premium is whatever the stored settlement amount (`payment.amount`) adds to the hammer, and
 * is omitted when the payment is missing or does not exceed the hammer. Bid records no VAT,
 * fee or shipping breakdown on a payment, so no such lines are invented.
 */
function costLines(hammerPrice: string, settlementAmount: string | undefined): LaxCostLineV1[] {
  const hammer = toPence(hammerPrice);
  if (hammer === null || hammer <= 0) return [];
  const lines: LaxCostLineV1[] = [{ kind: "hammer", amount: hammer, currency: PAYMENT_CURRENCY }];
  const settled = toPence(settlementAmount);
  if (settled !== null && settled > hammer) {
    lines.push({ kind: "premium", amount: settled - hammer, currency: PAYMENT_CURRENCY });
  }
  return lines;
}

function wonLotStatus(
  payment: BidPaymentFact | undefined,
  fulfilmentStatus: string | null,
): LaxPortfolioItemV1["status"] | null {
  if (!payment) return "awaiting_payment";
  if (UNPAID_PAYMENT_STATUSES.has(payment.status)) return "awaiting_payment";
  if (payment.status !== "captured") return null;
  return fulfilmentStatus !== null && IN_FULFILMENT_STATUSES.has(fulfilmentStatus)
    ? "awaiting_shipment"
    : "owned";
}

function wonLotItem(
  lot: BidWonLotFact,
  payment: BidPaymentFact | undefined,
  ctx: BidPortfolioContext,
): LaxPortfolioItemV1 | null {
  const status = wonLotStatus(payment, lot.fulfilmentStatus);
  // A refunded or abandoned purchase is not a holding; it still appears in the money ledger.
  if (!status) return null;

  const actions: LaxPortfolioActionV1[] = [];
  if (status === "awaiting_payment") {
    actions.push({ kind: "pay", href: `${ctx.webOrigin}/dashboard/checkout/${lot.lotId}` });
  } else {
    actions.push({ kind: "consign", href: `${ctx.webOrigin}/dashboard/submissions/new` });
  }
  actions.push({
    kind: "view",
    href: `${ctx.webOrigin}${lotPath({ id: lot.lotId, title: lot.title })}`,
  });

  const invoice: LaxPortfolioDocumentV1 = payment?.hasInvoice
    ? { kind: "invoice", available: true, href: paymentsPage(ctx) }
    : {
        kind: "invoice",
        available: false,
        expectedNote: "Your invoice appears here once it has been issued.",
      };

  return {
    product: "bid",
    id: lot.lotId,
    title: lot.title,
    artist: lot.artistName ?? "",
    image: ctx.imageUrl(lot.firstImageKey),
    acquiredAt: lot.endedAt.toISOString(),
    status,
    paid: { lines: costLines(lot.hammerPrice, payment?.amount) },
    documents: [invoice],
    actions,
    business: businessOf(ctx),
  };
}

function sellerLotStatus(lot: BidSellerLotFact): LaxPortfolioItemV1["status"] {
  if (lot.stage === "in_sale") return "in_sale";
  if (lot.payoutStatus === "paid") return "payout_paid";
  // Any other payout state (scheduled, in transit, failed, reversed) means the seller has not
  // been paid yet; a reversal puts the proceeds back with LAX, so the money is owed again.
  if (lot.payoutStatus !== null) return "payout_pending";
  return lot.buyerPaid ? "payout_pending" : "sold";
}

function sellerLotItem(lot: BidSellerLotFact, ctx: BidPortfolioContext): LaxPortfolioItemV1 {
  const documents: LaxPortfolioDocumentV1[] = lot.payoutHasStatement
    ? [{ kind: "payout_statement", available: true, href: payoutsPage(ctx) }]
    : [];
  return {
    product: "bid",
    id: lot.lotId,
    title: lot.title,
    artist: lot.artistName ?? "",
    image: ctx.imageUrl(lot.firstImageKey),
    acquiredAt: lot.occurredAt.toISOString(),
    status: sellerLotStatus(lot),
    paid: { lines: [] },
    documents,
    actions: [
      { kind: "view", href: `${ctx.webOrigin}${lotPath({ id: lot.lotId, title: lot.title })}` },
    ],
    business: businessOf(ctx),
  };
}

/** Wins, consignments awaiting review, lots in sale, and sales through to payout. */
export function buildBidPortfolioItems(
  facts: BidPortfolioFacts,
  ctx: BidPortfolioContext,
): LaxPortfolioItemV1[] {
  const paymentByLot = latestPaymentByLot(facts.payments);
  const won = facts.wonLots.flatMap((lot) => {
    const item = wonLotItem(lot, paymentByLot.get(lot.lotId), ctx);
    return item ? [item] : [];
  });
  const consigned = facts.submissions.map(
    (submission): LaxPortfolioItemV1 => ({
      product: "bid",
      id: submission.id,
      title: submission.title,
      artist: "",
      image: ctx.imageUrl(submission.firstImageKey),
      acquiredAt: submission.createdAt.toISOString(),
      status: "consigned",
      paid: { lines: [] },
      documents: [],
      actions: [{ kind: "view", href: `${ctx.webOrigin}/dashboard/submissions/${submission.id}` }],
      business: businessOf(ctx),
    }),
  );
  const selling = facts.sellerLots.map((lot) => sellerLotItem(lot, ctx));
  return [...won, ...consigned, ...selling];
}

function moneyStatus(status: string): LaxMoneyEntryV1["status"] {
  if (status === "paid") return "completed";
  if (status === "reversed") return "cancelled";
  return "pending";
}

function paymentEntries(payment: BidPaymentFact, ctx: BidPortfolioContext): LaxMoneyEntryV1[] {
  const amount = toPence(payment.amount);
  if (amount === null || amount < 0) return [];
  const base = {
    business: businessOf(ctx),
    amount,
    currency: PAYMENT_CURRENCY,
    occurredAt: payment.createdAt.toISOString(),
    href: paymentsPage(ctx),
  };
  const entry = (
    suffix: string,
    direction: LaxMoneyEntryV1["direction"],
    status: LaxMoneyEntryV1["status"],
  ): LaxMoneyEntryV1 => ({ id: `payment:${payment.id}${suffix}`, direction, status, ...base });

  if (UNPAID_PAYMENT_STATUSES.has(payment.status)) return [entry("", "owed_by_you", "pending")];
  if (payment.status === "cancelled") return [entry("", "owed_by_you", "cancelled")];
  // A refund can only follow a capture, and the payment keeps only its final status, so both
  // facts are reported: what was paid, and that it came back.
  if (payment.status === "refunded") {
    return [entry("", "paid", "completed"), entry(":refund", "refunded", "completed")];
  }
  return [entry("", "paid", "completed")];
}

function payoutEntries(payout: BidPayoutFact, ctx: BidPortfolioContext): LaxMoneyEntryV1[] {
  const status = moneyStatus(payout.status);
  const base = {
    business: businessOf(ctx),
    status,
    currency: payout.currency,
    occurredAt: (payout.processedAt ?? payout.periodEnd).toISOString(),
    href: payoutsPage(ctx),
  };
  const entries: LaxMoneyEntryV1[] = [];
  const net = toPence(payout.netAmount);
  if (net !== null && net !== 0) {
    // A negative net is a clawback: a refund after settlement means the seller owes the money
    // back (status `clawback_pending`, pending until reconciled), so it is owed by them, in
    // absolute terms. The contract does not allow negative amounts.
    entries.push({
      id: `payout:${payout.id}`,
      direction: net < 0 ? "owed_by_you" : "owed_to_you",
      amount: Math.abs(net),
      ...base,
    });
  }
  for (const [suffix, fee] of [
    [":platform-fee", payout.platformFee],
    [":processing-fee", payout.stripeFee],
  ] as const) {
    const amount = toPence(fee);
    if (amount !== null && amount > 0) {
      entries.push({ id: `payout:${payout.id}${suffix}`, direction: "fee", amount, ...base });
    }
  }
  return entries;
}

/** What the person owes, has paid, was refunded, is owed from sales, and the fees taken. */
export function buildBidMoneyEntries(
  facts: BidPortfolioFacts,
  ctx: BidPortfolioContext,
): LaxMoneyEntryV1[] {
  return [
    ...facts.payments.flatMap((payment) => paymentEntries(payment, ctx)),
    ...facts.payouts.flatMap((payout) => payoutEntries(payout, ctx)),
  ];
}
