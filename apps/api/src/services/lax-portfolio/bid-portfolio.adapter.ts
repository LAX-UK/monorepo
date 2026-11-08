import { type AmountOwedEntry, type StillToSend, decisivePaymentByLot } from "@auction/domain";
import type {
  LaxBusinessV1,
  LaxCostLineV1,
  LaxMoneyEntryV1,
  LaxPortfolioActionV1,
  LaxPortfolioDocumentV1,
  LaxPortfolioItemV1,
  LaxPortfolioOwedV1,
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
import { stillToSendOfPayments } from "../../lib/still-to-send.js";

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

/** What the account owes, by lot: the one reading Purchases, the header chip and the menu share. */
export type BidOwedByLot = ReadonlyMap<string, AmountOwedEntry>;

/** What a part-funded bank transfer still has to deliver, by lot. */
export type BidStillToSendByLot = ReadonlyMap<string, StillToSend>;

/**
 * The share of a part-funded bank transfer each of its invoices still has to send. Only an invoice
 * whose deciding payment is on its way inside such a transfer carries one; amounts stay in whole
 * pence from the database, and the shares are worked out once by the domain.
 */
export function stillToSendOf(payments: readonly BidPaymentFact[]): BidStillToSendByLot {
  return stillToSendOfPayments([...decisivePaymentByLot(payments).values()]);
}

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
  return `${ctx.webOrigin}/purchases#payment-history`;
}

function purchasesPage(ctx: BidPortfolioContext): string {
  return `${ctx.webOrigin}/purchases`;
}

function payoutsPage(ctx: BidPortfolioContext): string {
  return `${ctx.webOrigin}/selling/payouts`;
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

/**
 * Where a won lot stands. What is owed, held or cancelled comes from the amounts-owed reading;
 * the payment only says whether a paid lot is still with the saleroom or is the buyer's. A
 * payment being confirmed is not owed, but the work is not theirs yet either.
 */
function wonLotStatus(
  owed: AmountOwedEntry | undefined,
  payment: BidPaymentFact | undefined,
  fulfilmentStatus: string | null,
  stillToSend: StillToSend | undefined,
): LaxPortfolioItemV1["status"] | null {
  if (owed) return owed.state === "cancelled" ? null : "awaiting_payment";
  // A bank transfer that has delivered only part of the payment still leaves money to send.
  if (stillToSend) return "awaiting_payment";
  if (payment?.status === "authorized") return "payment_confirming";
  if (payment?.status !== "captured") return null;
  return fulfilmentStatus !== null && IN_FULFILMENT_STATUSES.has(fulfilmentStatus)
    ? "awaiting_shipment"
    : "owned";
}

/**
 * The amount due as the contract carries it, or null when no readable amount is known. A work in
 * a part-funded bank transfer owes its share of what is left to send (never both).
 */
function owedOf(
  owed: AmountOwedEntry | undefined,
  stillToSend?: StillToSend,
): LaxPortfolioOwedV1 | null {
  if (!owed && stillToSend) {
    return { amount: stillToSend.pence, currency: PAYMENT_CURRENCY, state: "still_to_send" };
  }
  if (!owed || owed.state === "cancelled") return null;
  const amount = toPence(owed.amountDue);
  if (amount === null) return null;
  return {
    amount,
    currency: owed.currency,
    state: owed.state === "in-review" ? "in_review" : "due",
    ...(owed.blocker ? { blocker: owed.blocker } : {}),
  };
}

function wonLotItem(
  lot: BidWonLotFact,
  payment: BidPaymentFact | undefined,
  owedEntry: AmountOwedEntry | undefined,
  stillToSend: StillToSend | undefined,
  ctx: BidPortfolioContext,
): LaxPortfolioItemV1 | null {
  const status = wonLotStatus(owedEntry, payment, lot.fulfilmentStatus, stillToSend);
  // A refunded, cancelled or ended purchase is not a holding; it still appears in the money ledger.
  if (!status) return null;

  const owed = owedOf(owedEntry, stillToSend);
  const actions: LaxPortfolioActionV1[] = [];
  if (status === "awaiting_payment") {
    // Payment cannot start while checks are open, so no pay link is offered until they clear. A
    // transfer under way is finished by sending the rest of it, not by paying again.
    if (owedEntry?.state !== "in-review" && !stillToSend) {
      actions.push({ kind: "pay", href: `${ctx.webOrigin}/purchases/checkout/${lot.lotId}` });
    }
  } else if (status !== "payment_confirming") {
    // A payment being confirmed leaves nothing to pay and nothing to consign yet.
    actions.push({ kind: "consign", href: `${ctx.webOrigin}/selling/new` });
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

  // The total one payment covers is the same figure Purchases shows, so the cost lines for a
  // lot still owed come from it rather than from a payment that may not exist yet.
  const total = status === "awaiting_payment" && owedEntry ? owedEntry.amountDue : payment?.amount;
  return {
    product: "bid",
    id: lot.lotId,
    title: lot.title,
    artist: lot.artistName ?? "",
    image: ctx.imageUrl(lot.firstImageKey),
    acquiredAt: lot.endedAt.toISOString(),
    status,
    paid: { lines: costLines(lot.hammerPrice, total ?? undefined) },
    documents: [invoice],
    actions,
    business: businessOf(ctx),
    ...(owed ? { owed } : {}),
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
  owed: BidOwedByLot,
): LaxPortfolioItemV1[] {
  const paymentByLot = decisivePaymentByLot(facts.payments);
  const stillToSend = stillToSendOf(facts.payments);
  const won = facts.wonLots.flatMap((lot) => {
    const item = wonLotItem(
      lot,
      paymentByLot.get(lot.lotId),
      owed.get(lot.lotId),
      stillToSend.get(lot.lotId),
      ctx,
    );
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
      actions: [{ kind: "view", href: `${ctx.webOrigin}/selling/consignments/${submission.id}` }],
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

/**
 * One owed line per won lot still awaiting payment, for the amount due on that purchase. It
 * follows exactly the rule the holdings use (`owedOf`), so the Money total owed and the
 * Portfolio total due are the same figure. Payment attempts never add to it.
 */
function owedEntries(
  wonLots: readonly BidWonLotFact[],
  owed: BidOwedByLot,
  stillToSend: BidStillToSendByLot,
  ctx: BidPortfolioContext,
): LaxMoneyEntryV1[] {
  return wonLots.flatMap((lot): LaxMoneyEntryV1[] => {
    const due = owedOf(owed.get(lot.lotId), stillToSend.get(lot.lotId));
    if (!due) return [];
    return [
      {
        id: `purchase:${lot.lotId}:owed`,
        business: businessOf(ctx),
        direction: "owed_by_you",
        status: "pending",
        amount: due.amount,
        currency: due.currency,
        occurredAt: lot.endedAt.toISOString(),
        product: "bid",
        href: purchasesPage(ctx),
        ...(due.state === "still_to_send" ? { stillToSend: true } : {}),
      },
    ];
  });
}

/**
 * What a completed payment contributes to the ledger. A payment that never completed (still
 * pending, awaiting confirmation or review, or cancelled) moved no money and is not a ledger
 * line; what is still owed comes from the purchase, not from the attempt.
 */
function paymentEntries(payment: BidPaymentFact, ctx: BidPortfolioContext): LaxMoneyEntryV1[] {
  if (payment.status !== "captured" && payment.status !== "refunded") return [];
  const amount = toPence(payment.amount);
  if (amount === null || amount < 0) return [];
  const base = {
    business: businessOf(ctx),
    amount,
    currency: PAYMENT_CURRENCY,
    occurredAt: payment.createdAt.toISOString(),
    product: "bid" as const,
    href: paymentsPage(ctx),
  };
  const entry = (suffix: string, direction: LaxMoneyEntryV1["direction"]): LaxMoneyEntryV1 => ({
    id: `payment:${payment.id}${suffix}`,
    direction,
    status: "completed",
    ...base,
  });

  // A refund can only follow a capture, and the payment keeps only its final status, so both
  // facts are reported: what was paid, and that it came back.
  if (payment.status === "refunded") return [entry("", "paid"), entry(":refund", "refunded")];
  return [entry("", "paid")];
}

function payoutEntries(payout: BidPayoutFact, ctx: BidPortfolioContext): LaxMoneyEntryV1[] {
  const status = moneyStatus(payout.status);
  const base = {
    business: businessOf(ctx),
    status,
    currency: payout.currency,
    occurredAt: (payout.processedAt ?? payout.periodEnd).toISOString(),
    product: "bid" as const,
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
  owed: BidOwedByLot,
): LaxMoneyEntryV1[] {
  return [
    ...owedEntries(facts.wonLots, owed, stillToSendOf(facts.payments), ctx),
    ...facts.payments.flatMap((payment) => paymentEntries(payment, ctx)),
    ...facts.payouts.flatMap((payout) => payoutEntries(payout, ctx)),
  ];
}
