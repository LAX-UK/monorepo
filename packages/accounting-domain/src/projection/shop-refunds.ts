import {
  type CreditNote,
  type Invoice,
  buildCreditNoteFor,
  creditedOnInvoiceLines,
  laxReference,
} from "../document.js";
import { type Pence, isPence, lineGrossPence } from "../money.js";
import type { RefundSplit } from "../refund.js";
import { ok, refuse } from "../result.js";
import { type BidRefundReversedFacts, projectBidRefundReversed } from "./bid-refunds.js";
import type { ParkedDocument, ProjectionPolicy } from "./projection.js";
import {
  SHOP_OUTSIDE_UK_DELIVERY_BOOKING,
  type ShopOrderPaidFacts,
  shopOrderInvoice,
} from "./shop.js";

/**
 * One Shop refund that went through: a `shop_refund` row that succeeded, through Stripe or settled
 * outside it by staff after it failed here, and that Stripe has not since reported failed
 * (`reversed_at`). A refund reversed after it succeeded is not listed: its credit note, if any, is
 * cancelled or held by its own event (`shop.refund.reversed`).
 */
export interface ShopRefundFacts {
  /** The `shop_refund` row's id: the credit note's source id (`LAX-SHOP-CN-<id>`). */
  readonly refundId: string;
  readonly amountPence: Pence;
  /** The London day the refund went through (or staff marked it settled outside Stripe). */
  readonly refundedOn: string;
  /** The order line the refund was for; null for a refund of the order as a whole. */
  readonly orderLineId: string | null;
  /** Staff marked it refunded outside Stripe: the money did not go back through clearing. */
  readonly settledOutside: boolean;
}

/** Every refund of one paid Shop order that went through, oldest first. */
export interface ShopRefundsFacts {
  /** The paid order as its own flow reads it: the invoice credited is rebuilt from it. */
  readonly order: ShopOrderPaidFacts;
  readonly refunds: readonly ShopRefundFacts[];
  /** The refund whose event is projected: refused for staff when it cannot be attributed. */
  readonly refundId: string;
  /**
   * Credit notes already registered (not cancelled) for the order's invoice in the books the switch
   * aims at now, in the order they were made. Each is kept exactly as stored; new ones follow.
   */
  readonly registered: readonly CreditNote[];
  /**
   * Credit notes already registered (not cancelled) for the order's outside-UK delivery invoice
   * (`LAX-SHOP-INV-<order>-delivery`), in the order they were made. Absent or empty when none.
   */
  readonly registeredDelivery?: readonly CreditNote[];
}

/** Where one refund's credit goes, once that is certain. */
interface Placement {
  /** Credited on the order's invoice: by role, and on the named line's group (`lines`) or filling. */
  readonly split: RefundSplit;
  readonly lines?: readonly number[];
  /** Credited on the outside-UK delivery invoice (a whole-order refund only). */
  readonly deliveryPence: Pence;
}

/** The source id of a refund's credit note on the outside-UK delivery invoice. */
export function shopDeliveryCreditSourceId(refundId: string): string {
  return `${refundId}-delivery`;
}

/**
 * Where a refund's credit goes on the invoice, only when that is certain; null when it is not.
 * - A refund naming a line is credited on that line, when it fits in what is left on it (with
 *   the lines the books cannot tell from it, `onLine`).
 * - A refund naming no line is credited when it takes everything still left (on the order's
 *   invoice, and on its outside-UK delivery invoice when it has one: a whole-order refund or
 *   cancellation), or when only one line has credit left and it fits there. An order with a
 *   delivery outside the UK has only the first: a part refund may be for that delivery.
 */
function placeRefund(
  invoice: Invoice,
  lineIndexById: ReadonlyMap<string, number>,
  left: readonly number[],
  refund: ShopRefundFacts,
  deliveryLeft: number | null,
): Placement | null {
  const onLine = (index: number): Placement | null => {
    const line = invoice.lines[index];
    if (!line) return null;
    // The lines the books cannot tell from this one: the same role, description and treatment,
    // and VAT in the same proportion. A credit on one is a credit on any of them, so the named
    // line's refund fills them in order (the line itself first).
    const group = [
      index,
      ...invoice.lines.flatMap((l, i) =>
        i !== index &&
        l.role === line.role &&
        l.description === line.description &&
        l.treatment === line.treatment &&
        l.vatPence * lineGrossPence(line) === line.vatPence * lineGrossPence(l)
          ? [i]
          : [],
      ),
    ];
    const room = group.reduce((sum, i) => sum + (left[i] ?? 0), 0);
    if (refund.amountPence > room) return null;
    const split =
      line.role === "goods"
        ? { goodsPence: refund.amountPence, deliveryPence: 0 }
        : { goodsPence: 0, deliveryPence: refund.amountPence };
    return { split, lines: group, deliveryPence: 0 };
  };
  if (refund.orderLineId !== null) {
    const index = lineIndexById.get(refund.orderLineId.toLowerCase());
    return index === undefined ? null : onLine(index);
  }
  const roleLeft = (role: "goods" | "delivery") =>
    invoice.lines.reduce((sum, l, i) => (l.role === role ? sum + (left[i] ?? 0) : sum), 0);
  const total = left.reduce((sum, pence) => sum + pence, 0);
  if (refund.amountPence === total + (deliveryLeft ?? 0)) {
    return {
      split: { goodsPence: roleLeft("goods"), deliveryPence: roleLeft("delivery") },
      deliveryPence: deliveryLeft ?? 0,
    };
  }
  if (deliveryLeft !== null) return null;
  const withRoom = left.flatMap((pence, i) => (pence > 0 ? [i] : []));
  return withRoom.length === 1 ? onLine(withRoom[0] as number) : null;
}

/**
 * Shop refund, cancellation or return (flow 21): the order's contact and invoice (a replay of the
 * paid flow), then a credit note per refund that went through, oldest first, against that invoice
 * (`LAX-SHOP-CN-<refund>`), each refunded from the Stripe clearing account.
 *
 * - The invoice is never credited more than it charged: a refund is credited only within what is
 *   left on its lines after the credit notes already registered (kept exactly as stored).
 * - A refund naming a line is credited on that line (`buildCreditNoteFor`'s `lines`).
 * - Nothing is guessed: a refund whose lines are not certain (`placeRefund`) is not credited, and
 *   neither is any later refund of the order (oldest first): a person books it by hand, and what
 *   is left on the invoice after that is no longer what LAX can see. Each is refused for staff on
 *   its own event (`refund_unattributed`); the other refunds' events leave them out. A refund
 *   left out is never credited later by another refund's event, so a hand booking is never
 *   credited a second time.
 * - A whole-order refund of an order with a delivery outside the UK is credited on both invoices:
 *   the delivery's part is a credit note on the delivery invoice
 *   (`LAX-SHOP-CN-<refund>-delivery`), parked with it while that invoice waits for the
 *   accountant (`vat_on_outside_uk_delivery`).
 * - A refund settled outside Stripe is credited, but LAX does not hold the account the money went
 *   back from: its credit notes give no money back and are parked (`refund_outside_stripe`), never
 *   sent, until staff name it.
 */
export const projectShopRefundSettled: ProjectionPolicy<ShopRefundsFacts> = (facts) => {
  const built = shopOrderInvoice(facts.order);
  if (!built.ok) return built;
  const { contact, invoice, outsideUkDelivery } = built.value;
  if (facts.registered.some((note) => note.invoiceReference !== invoice.reference)) {
    return refuse("bad_facts", "a registered credit note belongs to another invoice");
  }
  const registeredDelivery = facts.registeredDelivery ?? [];
  if (registeredDelivery.some((note) => note.invoiceReference !== outsideUkDelivery?.reference)) {
    return refuse("bad_facts", "a registered delivery credit note belongs to another invoice");
  }
  // The invoice's lines are the order's lines that charged something, in the same order.
  const lineIndexById = new Map<string, number>();
  for (const line of facts.order.lines) {
    if (line.grossPence > 0) lineIndexById.set(line.id.toLowerCase(), lineIndexById.size);
  }
  const roles = { goods: 0, delivery: 0 };
  for (const line of invoice.lines) roles[line.role] += lineGrossPence(line);

  const credits: CreditNote[] = [...facts.registered];
  const deliveryCredits: CreditNote[] = [...registeredDelivery];
  const made: CreditNote[] = [];
  const parked: ParkedDocument[] = [];
  const pending: ShopRefundFacts[] = [];
  for (const refund of facts.refunds) {
    if (!isPence(refund.amountPence) || refund.amountPence < 0) {
      return refuse("bad_amount", "a refund must be whole pence, not below zero");
    }
    const reference = laxReference("shop", "credit_note", refund.refundId);
    if (!reference.ok) return refuse("bad_source_id", reference.refusal.message);
    const deliveryReference = laxReference(
      "shop",
      "credit_note",
      shopDeliveryCreditSourceId(refund.refundId),
    );
    if (!deliveryReference.ok) return refuse("bad_source_id", deliveryReference.refusal.message);
    const registered =
      credits.some((note) => note.reference === reference.value) ||
      deliveryCredits.some((note) => note.reference === deliveryReference.value);
    if (refund.amountPence > 0 && !registered) pending.push(refund);
  }
  // Oldest first, once each. The first that cannot be placed stops the rest: they wait with it.
  let blockedBy: string | null = null;
  const waiting = new Set<string>();
  for (const refund of pending) {
    if (blockedBy !== null) {
      waiting.add(refund.refundId);
      continue;
    }
    const credited = creditedOnInvoiceLines(invoice, credits);
    if (!credited.ok) return credited;
    const left = invoice.lines.map((line, i) => lineGrossPence(line) - (credited.value[i] ?? 0));
    const deliveryLeft = outsideUkDelivery
      ? outsideUkDelivery.totals.grossPence -
        deliveryCredits.reduce((sum, note) => sum + note.totals.grossPence, 0)
      : null;
    const place = placeRefund(invoice, lineIndexById, left, refund, deliveryLeft);
    if (place === null) {
      blockedBy = refund.refundId;
      waiting.add(refund.refundId);
      continue;
    }
    const creditedGoods = invoice.lines.reduce(
      (sum, l, i) => (l.role === "goods" ? sum + (credited.value[i] ?? 0) : sum),
      0,
    );
    const creditedAll = credited.value.reduce((sum, p) => sum + p, 0);
    const parkAs = (reference: string, otherwise: ParkedDocument["reason"] | null) => {
      if (refund.settledOutside) parked.push({ reference, reason: "refund_outside_stripe" });
      else if (otherwise) parked.push({ reference, reason: otherwise });
    };
    const moneyBack = (issuedOn: string) =>
      refund.settledOutside
        ? {}
        : { refund: { account: "stripe_clearing" as const, refundedOn: issuedOn } };
    if (place.split.goodsPence + place.split.deliveryPence > 0) {
      const issuedOn = refund.refundedOn < invoice.issuedOn ? invoice.issuedOn : refund.refundedOn;
      const credit = buildCreditNoteFor(invoice, {
        sourceId: refund.refundId,
        issuedOn,
        buckets: {
          paidGoodsPence: roles.goods,
          paidDeliveryPence: roles.delivery,
          refundedGoodsPence: creditedGoods,
          refundedDeliveryPence: creditedAll - creditedGoods,
        },
        request: place.split,
        priorCredits: credits,
        ...(place.lines === undefined ? {} : { lines: place.lines }),
        ...moneyBack(issuedOn),
      });
      if (!credit.ok) return credit;
      credits.push(credit.value);
      made.push(credit.value);
      parkAs(credit.value.reference, null);
    }
    if (outsideUkDelivery && place.deliveryPence > 0) {
      const line = outsideUkDelivery.lines[0];
      if (!line || outsideUkDelivery.lines.length !== 1) {
        return refuse("bad_facts", "an outside-UK delivery invoice has one line");
      }
      const issuedOn =
        refund.refundedOn < outsideUkDelivery.issuedOn
          ? outsideUkDelivery.issuedOn
          : refund.refundedOn;
      const already = deliveryCredits.reduce((sum, note) => sum + note.totals.grossPence, 0);
      const gross = outsideUkDelivery.totals.grossPence;
      const credit = buildCreditNoteFor(outsideUkDelivery, {
        sourceId: shopDeliveryCreditSourceId(refund.refundId),
        issuedOn,
        buckets:
          line.role === "goods"
            ? {
                paidGoodsPence: gross,
                paidDeliveryPence: 0,
                refundedGoodsPence: already,
                refundedDeliveryPence: 0,
              }
            : {
                paidGoodsPence: 0,
                paidDeliveryPence: gross,
                refundedGoodsPence: 0,
                refundedDeliveryPence: already,
              },
        request:
          line.role === "goods"
            ? { goodsPence: place.deliveryPence, deliveryPence: 0 }
            : { goodsPence: 0, deliveryPence: place.deliveryPence },
        priorCredits: deliveryCredits,
        ...moneyBack(issuedOn),
      });
      if (!credit.ok) return credit;
      deliveryCredits.push(credit.value);
      made.push(credit.value);
      parkAs(
        credit.value.reference,
        SHOP_OUTSIDE_UK_DELIVERY_BOOKING === null ? "vat_on_outside_uk_delivery" : null,
      );
    }
  }
  // What is left waits for staff: refused on its own event, left out of the others'.
  if (waiting.has(facts.refundId)) {
    return refuse(
      "refund_unattributed",
      blockedBy === facts.refundId
        ? `refund ${facts.refundId}: which lines of the invoice it credits is not certain`
        : `refund ${facts.refundId}: waits behind refund ${blockedBy}, whose lines are not certain`,
    );
  }
  // The delivery invoice comes before its credit note, kept as the paid flow registered it.
  const withDelivery =
    outsideUkDelivery !== null &&
    made.some((n) => n.invoiceReference === outsideUkDelivery.reference);
  if (withDelivery && SHOP_OUTSIDE_UK_DELIVERY_BOOKING === null) {
    parked.unshift({
      reference: outsideUkDelivery.reference,
      reason: "vat_on_outside_uk_delivery",
    });
  }
  return ok({
    documents: [contact, invoice, ...(withDelivery ? [outsideUkDelivery] : []), ...made],
    ...(parked.length > 0 ? { parked } : {}),
  });
};

/**
 * What each credit note this projection makes was built after: the credit already on its invoice
 * when it was built (`registered` holds the notes of both the order's invoice and its outside-UK
 * delivery invoice). The registry checks it again under the invoice's credit lock, so two
 * projections that read different credit never both register (`credit_prior_changed`).
 */
export function shopCreditBuiltAfter(
  documents: readonly { readonly kind: string; readonly reference: string }[],
  registered: readonly CreditNote[],
): { reference: string; priorCreditPence: number }[] {
  // Per invoice: the order's own, and its outside-UK delivery invoice.
  const credit = new Map<string, number>();
  for (const note of registered) {
    credit.set(
      note.invoiceReference,
      (credit.get(note.invoiceReference) ?? 0) + note.totals.grossPence,
    );
  }
  const out: { reference: string; priorCreditPence: number }[] = [];
  for (const document of documents) {
    if (document.kind !== "credit_note") continue;
    const note = document as CreditNote;
    const before = credit.get(note.invoiceReference) ?? 0;
    out.push({ reference: note.reference, priorCreditPence: before });
    credit.set(note.invoiceReference, before + note.totals.grossPence);
  }
  return out;
}

/**
 * Shop refunds Stripe reported failed after they succeeded (`shop.refund.reversed`), each credit
 * note's LAX reference (on the order's invoice and, for a whole-order refund of an order delivered
 * outside the UK, on the delivery invoice) with where it stands in the books the switch aims at now.
 */
export type ShopRefundReversedFacts = BidRefundReversedFacts;

/**
 * A Shop refund taken back after its credit note was made: exactly as for Bid
 * (`projectBidRefundReversed`). A note never sent is cancelled; an issued one is held for a person
 * (`refund_reversed_after_credit`, with the alert, never refunded from clearing); one being sent
 * is tried again once it settles. The refund is then left out of the order's other refunds.
 */
export const projectShopRefundReversed: ProjectionPolicy<ShopRefundReversedFacts> =
  projectBidRefundReversed;
