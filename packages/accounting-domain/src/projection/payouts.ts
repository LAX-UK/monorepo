import { isValidIsoDate } from "../dates.js";
import {
  type Bill,
  type Contact,
  buildBill,
  buildBillPayment,
  buildContact,
  vendorContactSourceId,
} from "../document.js";
import { type LineInput, MAX_LINES, type Pence, type VatTreatment, isPence } from "../money.js";
import type { ParkReason } from "../parking.js";
import { type Result, ok, refuse } from "../result.js";
import type { ParkedDocument, Projection, ProjectionCode, ProjectionPolicy } from "./projection.js";

/**
 * How a payout is booked, once the accountant has said. The bill is always what the payee is
 * owed after LAX's commission (the payout ledger's net, to the penny), paid in full when LAX pays
 * out. What stays open is the accountant's:
 * - `owedTreatment`: the VAT treatment of each bill line (what LAX is charged by the payee). Never
 *   `standard`: LAX adds no VAT to what a seller or artist is owed; a payee who charges VAT is a
 *   different booking, not built.
 * - `commission: "netted"`: the commission and the VAT the agreement charged on it are kept by
 *   LAX inside the sale it already booked (a Bid hammer and a Shop sale are booked as LAX's own
 *   sale), so they make no Books document of their own and are stated on each bill line for the
 *   record. Invoicing the commission to the seller instead is a different booking (not built).
 * - `basis: "principal"`: LAX sold the work as principal (how Shop invoices are already booked).
 *   Selling as agent changes the Shop invoice too, so it is not built.
 */
export interface PayoutBooking {
  readonly owedTreatment: Exclude<VatTreatment, "standard">;
  readonly commission: "netted";
  readonly basis: "principal";
}

/** How a Bid seller payout is booked: null (parked, `seller_payout_treatment`) until the accountant answers. */
export const BID_SELLER_PAYOUT_BOOKING: PayoutBooking | null = null;

/** How a Shop artist payout is booked: null (parked, `artist_payout_treatment`) until the accountant answers. */
export const SHOP_ARTIST_PAYOUT_BOOKING: PayoutBooking | null = null;

const OWED_TREATMENTS: readonly VatTreatment[] = [
  "zero",
  "exempt",
  "margin_scheme",
  "outside_scope",
];

function validBooking(booking: PayoutBooking | null): booking is PayoutBooking {
  return (
    booking !== null &&
    OWED_TREATMENTS.includes(booking.owedTreatment) &&
    booking.commission === "netted" &&
    booking.basis === "principal"
  );
}

/** Pence as pounds without separators (`£1234.56`): exact, no floating point. */
export function poundsText(pence: Pence): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  return `${sign}£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Who a payout is paid to: a Bid seller's legal entity, or a Shop party. */
export interface PayeeFacts {
  /** The legal entity or party id; the vendor contact is `vendor-<id>`. */
  readonly id: string;
  readonly name: string;
}

function vendorContact(
  product: "bid" | "shop",
  payee: PayeeFacts,
): Result<Contact, ProjectionCode> {
  // A vendor is paid, never emailed by Books: no address is put on it.
  return buildContact({
    product,
    sourceId: vendorContactSourceId(payee.id),
    name: payee.name,
    email: null,
  });
}

/** One lot sale a Bid payout pays, split as its seller-terms snapshot split it. */
export interface BidPayoutSaleFacts {
  readonly lotId: string;
  readonly paymentId: string;
  readonly hammerPence: Pence;
  readonly commissionPence: Pence;
  /** What the agreement charged on the commission: `standard` VAT, or none (`not_registered`). */
  readonly commissionVatTreatment: "standard" | "not_registered";
  readonly commissionVatPence: Pence;
  /** What the seller is owed for the sale: hammer - commission - VAT on it. */
  readonly sellerNetPence: Pence;
}

/**
 * A Bid seller payout as stored (flow `bid_payout_settled`, and `bid_payout_paid` once paid):
 * the payout row's own ledger figures, the lot sales it pays from their snapshots, and any line
 * the bill cannot itemise. Dates are London calendar days.
 */
export interface BidPayoutFacts {
  readonly payoutId: string;
  readonly seller: PayeeFacts;
  /** The day the payout was made (the bill's date and due date). */
  readonly createdOn: string;
  /** The payout row's figures: gross - LAX's fee - Stripe's fee = net (what LAX owes). */
  readonly grossPence: Pence;
  readonly platformFeePence: Pence;
  readonly stripeFeePence: Pence;
  readonly netPence: Pence;
  /** Every lot sale paid from its seller-terms snapshot. */
  readonly sales: readonly BidPayoutSaleFacts[];
  /**
   * How many other lines the payout holds (a refund or adjustment, a private sale, a sale with no
   * snapshot, a dispute): the bill cannot itemise them, so it is booked whole by a person.
   */
  readonly otherLines: number;
  /** Set once the payout is paid: the day, and whether a Stripe transfer paid it. */
  readonly paid: { readonly paidOn: string; readonly throughStripe: boolean } | null;
}

/** The source id of a Bid payout's bill and its payment: the payout's own id. */
export function bidPayoutSourceId(payoutId: string): string {
  return String(payoutId).toLowerCase();
}

function badFacts(why: string): Result<never, ProjectionCode> {
  return refuse("bad_facts", why);
}

/**
 * The bill's lines for a Bid payout, one per lot sale (what the seller is owed for it, with the
 * hammer, commission and VAT on it stated), and why it is parked, if it is. A payout the bill
 * cannot itemise is billed as one line of its net, parked for a person.
 */
function bidPayoutBill(
  facts: BidPayoutFacts,
  contactReference: string,
  booking: PayoutBooking | null,
): Result<{ bill: Bill; park: ParkReason | null }, ProjectionCode> {
  const money = [facts.grossPence, facts.platformFeePence, facts.stripeFeePence, facts.netPence];
  if (!money.every(isPence) || !isValidIsoDate(facts.createdOn)) {
    return badFacts("a payout's figures are whole pence and its day a calendar day");
  }
  if (facts.grossPence - facts.platformFeePence - facts.stripeFeePence !== facts.netPence) {
    return badFacts("the payout's net is not its gross less its fees");
  }
  if (facts.netPence <= 0) return refuse("bad_amount", "a payout with nothing owed has no bill");
  for (const sale of facts.sales) {
    const parts = [
      sale.hammerPence,
      sale.commissionPence,
      sale.commissionVatPence,
      sale.sellerNetPence,
    ];
    if (!parts.every((p) => isPence(p) && p >= 0))
      return badFacts("a sale's figures are whole pence");
    if (sale.hammerPence - sale.commissionPence - sale.commissionVatPence !== sale.sellerNetPence) {
      return badFacts("a sale's seller net is not its hammer less commission and VAT");
    }
    if (sale.commissionVatTreatment === "not_registered" && sale.commissionVatPence !== 0) {
      return badFacts("no VAT is charged on commission when the company is not registered");
    }
  }
  // While parked the lines carry `outside_scope` only as a placeholder: a parked bill is never
  // sent, and the change that ships the accountant's answer rebuilds it.
  const treatment: VatTreatment = validBooking(booking) ? booking.owedTreatment : "outside_scope";
  const itemised =
    facts.otherLines === 0 &&
    facts.stripeFeePence === 0 &&
    facts.sales.length > 0 &&
    facts.sales.length <= MAX_LINES;
  let lines: LineInput[];
  if (itemised) {
    const owed = facts.sales.reduce((sum, s) => sum + s.sellerNetPence, 0);
    const hammer = facts.sales.reduce((sum, s) => sum + s.hammerPence, 0);
    // The ledger is the sales added up (so LAX's fee is their commission and VAT): anything else
    // is a fault, never billed.
    if (owed !== facts.netPence || hammer !== facts.grossPence) {
      return badFacts("the payout's figures are not its sales added up");
    }
    lines = facts.sales
      .filter((s) => s.sellerNetPence > 0)
      .map((s) => ({
        description: `Lot ${s.lotId.toLowerCase()}: hammer ${poundsText(s.hammerPence)} less commission ${poundsText(s.commissionPence)} and VAT on it ${poundsText(s.commissionVatPence)}`,
        quantity: 1,
        unitNetPence: s.sellerNetPence,
        treatment,
        role: "goods",
      }));
  } else {
    lines = [
      {
        description: `Seller payout ${bidPayoutSourceId(facts.payoutId)}: gross ${poundsText(facts.grossPence)} less LAX fees ${poundsText(facts.platformFeePence)} and Stripe fees ${poundsText(facts.stripeFeePence)}`,
        quantity: 1,
        unitNetPence: facts.netPence,
        treatment,
        role: "goods",
      },
    ];
  }
  const bill = buildBill({
    product: "bid",
    sourceId: bidPayoutSourceId(facts.payoutId),
    contactReference,
    issuedOn: facts.createdOn,
    dueOn: facts.createdOn,
    lines,
  });
  if (!bill.ok) return bill;
  if (bill.value.totals.grossPence !== facts.netPence || bill.value.totals.vatPence !== 0) {
    return badFacts("the bill is not exactly what the payout owes");
  }
  const park: ParkReason | null = !itemised
    ? "payout_lines_unmapped"
    : validBooking(booking)
      ? null
      : "seller_payout_treatment";
  return ok({ bill: bill.value, park });
}

/**
 * A Bid seller payout made: the seller's vendor contact and the bill for what LAX owes them (the
 * payout's net, after the agreement's commission and the VAT on it), parked while the accountant
 * has not said how it is booked or when the payout holds lines a bill cannot itemise.
 */
export function bidPayoutSettledPolicy(
  booking: PayoutBooking | null,
): ProjectionPolicy<BidPayoutFacts> {
  return (facts): Result<Projection, ProjectionCode> => {
    const contact = vendorContact("bid", facts.seller);
    if (!contact.ok) return contact;
    const built = bidPayoutBill(facts, contact.value.reference, booking);
    if (!built.ok) return built;
    const { bill, park } = built.value;
    const parked: ParkedDocument[] = park ? [{ reference: bill.reference, reason: park }] : [];
    return ok({ documents: [contact.value, bill], parked });
  };
}

/**
 * A Bid seller payout paid: the contact and the bill again (a replay; a payout whose figures
 * changed since its bill was registered is refused by the registry, for a person), then the bill
 * paid in full from Stripe clearing. Parked with its bill, or when it was paid outside Stripe.
 */
export function bidPayoutPaidPolicy(
  booking: PayoutBooking | null,
): ProjectionPolicy<BidPayoutFacts> {
  const settled = bidPayoutSettledPolicy(booking);
  return (facts): Result<Projection, ProjectionCode> => {
    if (facts.paid === null) return badFacts("a payout's payment needs the payout paid");
    if (!isValidIsoDate(facts.paid.paidOn)) return badFacts("the paid day is a calendar day");
    const head = settled(facts);
    if (!head.ok) return head;
    return withPayment(head.value, facts.paid.paidOn, facts.paid.throughStripe);
  };
}

/** Add the bill's payment to a projection holding the contact and the bill, parked as the bill is. */
function withPayment(
  head: Projection,
  paidOn: string,
  throughStripe: boolean,
): Result<Projection, ProjectionCode> {
  const bill = head.documents.find((d): d is Bill => d.kind === "bill");
  if (!bill) return badFacts("a payout's payment pays its bill");
  const payment = buildBillPayment({ bill, paidOn });
  if (!payment.ok) return payment;
  const billParked = head.parked?.find((p) => p.reference === bill.reference)?.reason ?? null;
  const reason: ParkReason | null =
    billParked ?? (throughStripe ? null : "payout_paid_outside_stripe");
  return ok({
    documents: [...head.documents, payment.value],
    parked: [
      ...(head.parked ?? []),
      ...(reason ? [{ reference: payment.value.reference, reason }] : []),
    ],
  });
}

/** The policies in force: parked until `BID_SELLER_PAYOUT_BOOKING` is set. */
export const projectBidPayoutSettled = bidPayoutSettledPolicy(BID_SELLER_PAYOUT_BOOKING);
export const projectBidPayoutPaid = bidPayoutPaidPolicy(BID_SELLER_PAYOUT_BOOKING);

/** Where a Shop payout's money came from: an order line, a sale recorded for a third party, an original. */
export type ShopPayoutSource = "order_line" | "third_party_sale" | "original_sale";

/**
 * A Shop artist payout paid, read from its `shop_payout_ledger` row (flow `shop_artist_payout_paid`).
 * Dates are London calendar days.
 */
export interface ShopArtistPayoutFacts {
  readonly payoutId: string;
  readonly payee: PayeeFacts;
  readonly source: ShopPayoutSource;
  /** The order line, third-party sale or original sale the payout is for. */
  readonly sourceRowId: string;
  /** The sale, LAX's commission taken from it, and what the payee is owed: gross - deductions. */
  readonly grossPence: Pence;
  readonly deductionsPence: Pence;
  readonly netPence: Pence;
  /** The day the payout was recorded (the bill's date), and the day it fell due. */
  readonly owedOn: string;
  readonly dueOn: string;
  readonly paidOn: string;
  /** Paid by a Stripe Connect transfer (from Stripe clearing), not marked paid by staff. */
  readonly throughStripe: boolean;
}

const SOURCE_TEXT: Readonly<Record<ShopPayoutSource, string>> = {
  order_line: "order line",
  third_party_sale: "third-party sale",
  original_sale: "original sale",
};

/**
 * A Shop artist payout paid: the payee's vendor contact, the bill for what they are owed (the
 * ledger row's net: the sale less LAX's commission), and its payment from Stripe clearing. Parked
 * while the accountant has not said how an artist payout is booked (principal or agent), and the
 * payment when staff marked it paid outside Stripe.
 */
export function shopArtistPayoutPaidPolicy(
  booking: PayoutBooking | null,
): ProjectionPolicy<ShopArtistPayoutFacts> {
  return (facts): Result<Projection, ProjectionCode> => {
    const money = [facts.grossPence, facts.deductionsPence, facts.netPence];
    if (!money.every((p) => isPence(p) && p >= 0)) return badFacts("figures are whole pence");
    if (facts.grossPence - facts.deductionsPence !== facts.netPence) {
      return badFacts("the payout's net is not the sale less LAX's commission");
    }
    if (facts.netPence <= 0) return refuse("bad_amount", "a payout with nothing owed has no bill");
    if (![facts.owedOn, facts.dueOn, facts.paidOn].every(isValidIsoDate)) {
      return badFacts("a payout's days are calendar days");
    }
    const contact = vendorContact("shop", facts.payee);
    if (!contact.ok) return contact;
    const treatment: VatTreatment = validBooking(booking) ? booking.owedTreatment : "outside_scope";
    const bill = buildBill({
      product: "shop",
      sourceId: String(facts.payoutId).toLowerCase(),
      contactReference: contact.value.reference,
      issuedOn: facts.owedOn,
      dueOn: facts.dueOn < facts.owedOn ? facts.owedOn : facts.dueOn,
      lines: [
        {
          description: `Artist payout for ${SOURCE_TEXT[facts.source]} ${String(facts.sourceRowId).toLowerCase()}: sale ${poundsText(facts.grossPence)} less LAX commission ${poundsText(facts.deductionsPence)}`,
          quantity: 1,
          unitNetPence: facts.netPence,
          treatment,
          role: "goods",
        },
      ],
    });
    if (!bill.ok) return bill;
    const head: Projection = {
      documents: [contact.value, bill.value],
      parked: validBooking(booking)
        ? []
        : [{ reference: bill.value.reference, reason: "artist_payout_treatment" }],
    };
    return withPayment(head, facts.paidOn, facts.throughStripe);
  };
}

/** The policy in force: parked until `SHOP_ARTIST_PAYOUT_BOOKING` is set. */
export const projectShopArtistPayoutPaid = shopArtistPayoutPaidPolicy(SHOP_ARTIST_PAYOUT_BOOKING);
