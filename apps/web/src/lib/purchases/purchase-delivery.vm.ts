import type {
  AccountPurchaseFacts,
  CollectionBookingOffer,
} from "@/lib/data/http/account-buying.types";
import { formatMoney } from "@/lib/format-currency";

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
});

/** Where the work is collected from, and how a time is booked. */
export type CollectionVm = {
  place: string | null;
  hours: string | null;
  /** "Email us to book" while self-serve booking is off; `null` once it is on. */
  bookingEmail: string | null;
};

/**
 * The delivery panel on a purchase, one state at a time. Each state carries only what it shows
 * and the steps this member may take; a member who does not pay is told, never asked.
 */
export type DeliveryPanelVm =
  | { kind: "told"; line: string }
  | { kind: "choose"; beforePayment: boolean; collection: CollectionVm | null }
  | { kind: "quote-requested"; line: string; canWithdraw: boolean }
  | {
      kind: "quote-ready";
      amount: string;
      note: string | null;
      destination: string;
      canAccept: boolean;
      canDecline: boolean;
    }
  | { kind: "collect"; line: string; collection: CollectionVm | null }
  | { kind: "in-transit"; line: string; tracking: string | null }
  | { kind: "done"; line: string };

function collectionOf(offer: CollectionBookingOffer | null): CollectionVm | null {
  if (!offer) return null;
  return {
    place: offer.place,
    hours: offer.hours,
    bookingEmail: offer.kind === "email" ? offer.email : null,
  };
}

/** The delivery panel for a purchase, from the account's facts and the collection offer. */
export function deliveryPanel(input: {
  facts: AccountPurchaseFacts;
  collection: CollectionBookingOffer | null;
  /** Who pays, when this member does not: "Northbank Gallery's finance team". */
  payerTeam: string;
}): DeliveryPanelVm {
  const { facts, payerTeam } = input;
  const payer = facts.paymentRole === "payer";
  const { delivery } = facts;
  const quote = delivery.quote;
  const collection = collectionOf(input.collection);
  switch (delivery.stage) {
    case "awaiting_payment":
    case "choose":
      return payer
        ? { kind: "choose", beforePayment: delivery.stage === "awaiting_payment", collection }
        : { kind: "told", line: `${payerTeam} chooses how the work is delivered.` };
    case "quote_requested":
      return {
        kind: "quote-requested",
        line: `Asked on ${DAY_MONTH.format(quote?.requestedAt ?? new Date())}. We reply within 2 working days.`,
        canWithdraw: Boolean(quote?.actions.includes("withdraw")),
      };
    case "quote_ready":
      return {
        kind: "quote-ready",
        amount: quote?.amount ? formatMoney(quote.amount, quote.currency) : "–",
        note: quote?.quoteNote ?? null,
        destination: quote?.destination ?? "",
        canAccept: Boolean(quote?.actions.includes("accept")),
        canDecline: Boolean(quote?.actions.includes("withdraw")),
      };
    case "booked":
      return {
        kind: "done",
        line: "Your courier delivery is booked. We'll email you when it leaves us.",
      };
    case "preparing":
      return {
        kind: "collect",
        line: "We're preparing the work for collection.",
        collection,
      };
    case "ready_to_collect":
      return { kind: "collect", line: "The work is ready to collect.", collection };
    case "in_transit":
      return {
        kind: "in-transit",
        line: delivery.carrier ? `On its way with ${delivery.carrier}.` : "On its way.",
        tracking: delivery.trackingNumber,
      };
    case "delivered":
      return { kind: "done", line: "Delivered." };
    case "collected":
      return {
        kind: "done",
        line: [
          "Collected",
          delivery.collectedBy ? ` by ${delivery.collectedBy}` : "",
          delivery.collectedAt ? ` on ${DAY_MONTH.format(delivery.collectedAt)}` : "",
          ".",
        ].join(""),
      };
    case "cancelled":
      return { kind: "done", line: "This purchase was cancelled, so there is nothing to deliver." };
  }
}
