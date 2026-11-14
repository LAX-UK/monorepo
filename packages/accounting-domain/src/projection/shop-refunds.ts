import { type CreditNote, type Invoice, buildCreditNoteFor, laxReference } from "../document.js";
import { type Pence, isPence, lineGrossPence } from "../money.js";
import type { RefundSplit } from "../refund.js";
import { ok, refuse } from "../result.js";
import type { ParkedDocument, ProjectionPolicy } from "./projection.js";
import { type ShopOrderPaidFacts, shopOrderInvoice } from "./shop.js";

/**
 * One Shop refund that went through: a `shop_refund` row that succeeded, through Stripe or settled
 * outside it by staff after it failed here. A succeeded refund is final in the Shop (a later
 * failure never moves it back), so it is never taken back.
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
}

/** What is already credited on each invoice line, filling lines in order within their role. */
function creditedPerLine(invoice: Invoice, credits: readonly CreditNote[]): number[] {
  const byRole = { goods: 0, delivery: 0 };
  for (const credit of credits) {
    for (const line of credit.lines) byRole[line.role] += lineGrossPence(line);
  }
  return invoice.lines.map((line) => {
    const gross = lineGrossPence(line);
    const taken = Math.min(byRole[line.role], gross);
    byRole[line.role] -= taken;
    return taken;
  });
}

/**
 * Where a refund's credit goes on the invoice, only when that is certain; null when it is not.
 * Credit notes fill an invoice's lines in order within each role (`buildCreditNoteFor`), so:
 * - a refund naming a line is placed when that line is the first in its role with credit left and
 *   the refund fits in it;
 * - a refund naming no line is placed when it takes everything still credited on the invoice, or
 *   when only one line has credit left and it fits there. Neither when the order also has a
 *   delivery outside the UK invoiced on its own: the refund may be for that delivery.
 */
function placeRefund(
  invoice: Invoice,
  lineIndexById: ReadonlyMap<string, number>,
  credited: readonly number[],
  refund: ShopRefundFacts,
  outsideUkDelivery: boolean,
): RefundSplit | null {
  const left = invoice.lines.map((line, i) => lineGrossPence(line) - (credited[i] ?? 0));
  const split = (index: number): RefundSplit | null => {
    const line = invoice.lines[index];
    if (!line || refund.amountPence > (left[index] ?? 0)) return null;
    const firstWithRoom = invoice.lines.findIndex(
      (l, i) => l.role === line.role && (left[i] ?? 0) > 0,
    );
    if (firstWithRoom !== index) return null;
    return line.role === "goods"
      ? { goodsPence: refund.amountPence, deliveryPence: 0 }
      : { goodsPence: 0, deliveryPence: refund.amountPence };
  };
  if (refund.orderLineId !== null) {
    const index = lineIndexById.get(refund.orderLineId.toLowerCase());
    return index === undefined ? null : split(index);
  }
  if (outsideUkDelivery) return null;
  const total = left.reduce((sum, pence) => sum + pence, 0);
  if (refund.amountPence === total) {
    const roleLeft = (role: "goods" | "delivery") =>
      invoice.lines.reduce((sum, l, i) => (l.role === role ? sum + (left[i] ?? 0) : sum), 0);
    return { goodsPence: roleLeft("goods"), deliveryPence: roleLeft("delivery") };
  }
  const withRoom = left.flatMap((pence, i) => (pence > 0 ? [i] : []));
  return withRoom.length === 1 ? split(withRoom[0] as number) : null;
}

/**
 * Shop refund, cancellation or return (flow 21): the order's contact and invoice (a replay of the
 * paid flow), then a credit note per refund that went through, oldest first, against that invoice
 * (`LAX-SHOP-CN-<refund>`), each refunded from the Stripe clearing account.
 *
 * - The invoice is never credited more than it charged: a refund is credited only within what is
 *   left on its lines after the credit notes already registered (kept exactly as stored).
 * - Nothing is guessed: a refund whose lines are not certain (`placeRefund`) is not credited. It is
 *   refused for staff on its own event (`refund_unattributed`); later refunds' events leave it out.
 * - A refund settled outside Stripe is credited, but LAX does not hold the account the money went
 *   back from: its credit note gives no money back and is parked (`refund_outside_stripe`), never
 *   sent, until staff name it.
 */
export const projectShopRefundSettled: ProjectionPolicy<ShopRefundsFacts> = (facts) => {
  const built = shopOrderInvoice(facts.order);
  if (!built.ok) return built;
  const { contact, invoice, outsideUkDelivery } = built.value;
  if (facts.registered.some((note) => note.invoiceReference !== invoice.reference)) {
    return refuse("bad_facts", "a registered credit note belongs to another invoice");
  }
  // The invoice's lines are the order's lines that charged something, in the same order.
  const lineIndexById = new Map<string, number>();
  for (const line of facts.order.lines) {
    if (line.grossPence > 0) lineIndexById.set(line.id.toLowerCase(), lineIndexById.size);
  }
  const roles = { goods: 0, delivery: 0 };
  for (const line of invoice.lines) roles[line.role] += lineGrossPence(line);

  const credits: CreditNote[] = [...facts.registered];
  const made: CreditNote[] = [];
  const parked: ParkedDocument[] = [];
  for (const refund of facts.refunds) {
    if (!isPence(refund.amountPence) || refund.amountPence < 0) {
      return refuse("bad_amount", "a refund must be whole pence, not below zero");
    }
    const reference = laxReference("shop", "credit_note", refund.refundId);
    if (!reference.ok) return refuse("bad_source_id", reference.refusal.message);
    if (refund.amountPence === 0 || credits.some((note) => note.reference === reference.value)) {
      continue;
    }
    const credited = creditedPerLine(invoice, credits);
    const request = placeRefund(invoice, lineIndexById, credited, refund, outsideUkDelivery);
    if (request === null) {
      if (refund.refundId === facts.refundId) {
        return refuse(
          "refund_unattributed",
          `refund ${refund.refundId}: which lines of the invoice it credits is not certain`,
        );
      }
      continue;
    }
    const creditedGoods = invoice.lines.reduce(
      (sum, l, i) => (l.role === "goods" ? sum + (credited[i] ?? 0) : sum),
      0,
    );
    const issuedOn = refund.refundedOn < invoice.issuedOn ? invoice.issuedOn : refund.refundedOn;
    const credit = buildCreditNoteFor(invoice, {
      sourceId: refund.refundId,
      issuedOn,
      buckets: {
        paidGoodsPence: roles.goods,
        paidDeliveryPence: roles.delivery,
        refundedGoodsPence: creditedGoods,
        refundedDeliveryPence: credited.reduce((sum, p) => sum + p, 0) - creditedGoods,
      },
      request,
      priorCredits: credits,
      ...(refund.settledOutside
        ? {}
        : { refund: { account: "stripe_clearing" as const, refundedOn: issuedOn } }),
    });
    if (!credit.ok) return credit;
    credits.push(credit.value);
    made.push(credit.value);
    if (refund.settledOutside) {
      parked.push({ reference: credit.value.reference, reason: "refund_outside_stripe" });
    }
  }
  return ok({ documents: [contact, invoice, ...made], ...(parked.length > 0 ? { parked } : {}) });
};

/**
 * What each credit note this projection makes was built after: the credit already on the invoice
 * when it was built. The registry checks it again under the invoice's credit lock, so two
 * projections that read different credit never both register (`credit_prior_changed`).
 */
export function shopCreditBuiltAfter(
  documents: readonly { readonly kind: string; readonly reference: string }[],
  registered: readonly CreditNote[],
): { reference: string; priorCreditPence: number }[] {
  let credit = registered.reduce((sum, note) => sum + note.totals.grossPence, 0);
  const out: { reference: string; priorCreditPence: number }[] = [];
  for (const document of documents) {
    if (document.kind !== "credit_note") continue;
    out.push({ reference: document.reference, priorCreditPence: credit });
    credit += (document as CreditNote).totals.grossPence;
  }
  return out;
}
