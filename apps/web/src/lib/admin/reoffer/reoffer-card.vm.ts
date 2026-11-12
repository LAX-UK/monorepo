import { MAX_REOFFERS_PER_DEFAULT, reofferProgress } from "@auction/domain";
import {
  type StatusPresentation,
  type StepState,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import type {
  NextBidderNoneReason,
  ReofferPreview,
  StaffBuyerDefault,
  StaffReoffer,
} from "@auction/validators";
import { NO_NEXT_BIDDER_COPY } from "./reoffer-copy";
import { REOFFER_STATUS_PRESENTATION, SELLER_PREFERENCE_LABEL } from "./reoffer-status";

export const READ_ONLY_NOTE =
  "Only Sales managers, Finance and Administrators can act on a re-offer.";

/** What a person can do with the card: act on the offer, and answer for the seller. */
export type ReofferCardAccess = { canAct: boolean; canRecordAnswer: boolean };

export type ReofferStep = {
  id: "default" | "seller" | "offer" | "accepted";
  label: string;
  /** Lines under the label, each one fact. */
  details: string[];
  /** The step's date, in the one date style. */
  when: string | null;
  state: StepState;
};

export type ReofferActionId =
  | "start"
  | "record_answer"
  | "send"
  | "withdraw"
  | "next_bidder"
  | "return_to_inventory";

export type ReofferAction = {
  id: ReofferActionId;
  label: string;
  /** One main action per card; withdrawing reads as a danger link. */
  variant: "primary" | "secondary" | "danger";
};

export type ReofferCardModel = {
  badge: StatusPresentation | null;
  /** "Offer 1 of up to 3", or `null` before the first offer. */
  position: string | null;
  steps: ReofferStep[];
  /** What to know before choosing, such as who is next in line. */
  notice: { title: string; body: string } | null;
  actions: ReofferAction[];
  /** Said instead of buttons when the person can only look. */
  readOnlyNote: string | null;
  /** The offer the actions apply to. */
  current: StaffReoffer | null;
};

type Input = {
  buyerDefault: StaffBuyerDefault;
  offers: readonly StaffReoffer[];
  preview: ReofferPreview;
  access: ReofferCardAccess;
};

const by = (name: string | null, fallback: string) => name ?? fallback;
const money = (minor: number) => formatStaffMoney(minor);
const when = (iso: string | null) => (iso ? formatStaffDateTime(iso) : null);

function defaultStep(input: Input): ReofferStep {
  const { buyerDefault } = input;
  const facts = [
    buyerDefault.voidedInvoiceNumber ? `Invoice ${buyerDefault.voidedInvoiceNumber} voided` : null,
    buyerDefault.recordedByName ? `by ${buyerDefault.recordedByName}` : null,
  ].filter((fact): fact is string => fact !== null);
  return {
    id: "default",
    label: "Buyer default recorded",
    details: facts.length > 0 ? [facts.join(" · ")] : [],
    when: when(buyerDefault.recordedAt),
    state: "done",
  };
}

function sellerStep(offer: StaffReoffer | null): ReofferStep {
  const base = { id: "seller", label: "Seller's agreement" } as const;
  if (!offer) return { ...base, details: [], when: null, state: "todo" };
  const { consent } = offer;
  const answeredBy = by(consent.answeredByName, "the seller");
  switch (offer.consentStatus) {
    case "not_needed":
      return {
        ...base,
        details: ["LAX-owned, no consent needed"],
        when: null,
        state: "done",
      };
    case "given":
      return {
        ...base,
        details: [
          consent.channel === "recorded_by_staff"
            ? `Recorded by ${answeredBy}: ${consent.note ?? "agreed"}`
            : `Agreed in the workspace by ${answeredBy}`,
        ],
        when: when(consent.answeredAt),
        state: "done",
      };
    case "refused": {
      const preference = consent.declinePreference
        ? ` · prefers: ${SELLER_PREFERENCE_LABEL[consent.declinePreference] ?? consent.declinePreference}`
        : "";
      return {
        ...base,
        details: [
          consent.channel === "recorded_by_staff"
            ? `Declined, recorded by ${answeredBy}: ${consent.note ?? ""}${preference}`
            : `Declined by ${answeredBy}${preference}`,
        ],
        when: when(consent.answeredAt),
        state: "stopped",
      };
    }
    case "lapsed":
      return {
        ...base,
        details: [
          `No answer by ${when(offer.consentDueAt) ?? "the due date"}.${
            consent.remindedAt ? ` Reminder sent ${when(consent.remindedAt)}.` : ""
          }`,
        ],
        when: null,
        state: "stopped",
      };
    case "requested":
      return {
        ...base,
        details: [
          `Asked in their workspace and by email${
            consent.remindedAt ? ` · reminder ${when(consent.remindedAt)}` : ""
          }`,
        ],
        when: offer.consentDueAt ? `Answer by ${when(offer.consentDueAt)}` : null,
        state: "current",
      };
  }
}

function bidLine(offer: StaffReoffer): string {
  const name = by(offer.bidder.accountName, "The next bidder");
  const placed = offer.bidPlacedAt ? ` on ${when(offer.bidPlacedAt)}` : "";
  return `${name} · bid ${money(offer.offerMinor)}${placed}`;
}

function offerStep(offer: StaffReoffer | null, preview: ReofferPreview): ReofferStep {
  const base = { id: "offer", label: "Offer to the next bidder" } as const;
  if (!offer) {
    const next = preview.next;
    return {
      ...base,
      details: next
        ? [
            `${by(next.accountName, "The next bidder")} · bid ${money(next.bidMinor)} on ${when(next.placedAt)}`,
          ]
        : [],
      when: null,
      state: "todo",
    };
  }
  const name = by(offer.bidder.accountName, "the bidder");
  switch (offer.status) {
    case "awaiting_seller":
    case "seller_declined":
    case "seller_lapsed":
      return { ...base, details: [bidLine(offer)], when: null, state: "todo" };
    case "ready":
      return {
        ...base,
        details: [`${name} · ${money(offer.offerMinor)} · not sent yet`],
        when: null,
        state: "current",
      };
    case "offered":
      return {
        ...base,
        details: [`Sent to ${name}`],
        when: offer.offerEndsAt ? `Ends ${when(offer.offerEndsAt)}` : when(offer.offerSentAt),
        state: "current",
      };
    case "accepted":
      return {
        ...base,
        details: [`Accepted by ${name}`],
        when: when(offer.respondedAt),
        state: "done",
      };
    case "declined":
      return {
        ...base,
        details: [
          offer.declineReason
            ? `Declined by ${name}: “${offer.declineReason}”`
            : `Declined by ${name}`,
        ],
        when: when(offer.respondedAt),
        state: "stopped",
      };
    case "expired":
      return {
        ...base,
        details: [`${name} did not answer before the offer ended`],
        when: when(offer.offerEndsAt),
        state: "stopped",
      };
    case "withdrawn":
      return {
        ...base,
        details: [
          `Withdrawn${offer.closedByName ? ` by ${offer.closedByName}` : ""}${
            offer.closeReason ? `: ${offer.closeReason}` : ""
          }`,
        ],
        when: null,
        state: "stopped",
      };
  }
}

function acceptedStep(offer: StaffReoffer | null): ReofferStep {
  const done = offer?.status === "accepted";
  return {
    id: "accepted",
    label: "Accepted and invoiced",
    details: done ? [`Invoice raised for ${money(offer.offerMinor)} hammer`] : [],
    when: done ? when(offer.respondedAt) : null,
    state: done ? "done" : "todo",
  };
}

/** The actions each state offers, before a person's permissions and the lot's facts narrow them. */
function actionsFor(
  offer: StaffReoffer | null,
  preview: ReofferPreview,
  canOfferAgain: boolean,
): ReofferAction[] {
  const send: ReofferAction = { id: "send", label: "Send offer…", variant: "primary" };
  const withdraw: ReofferAction = { id: "withdraw", label: "Withdraw…", variant: "danger" };
  const record: ReofferAction = {
    id: "record_answer",
    label: "Record seller's answer…",
    variant: "secondary",
  };
  const next: ReofferAction = {
    id: "next_bidder",
    label: "Offer to the next bidder…",
    variant: "primary",
  };
  const back: ReofferAction = {
    id: "return_to_inventory",
    label: "Return to inventory…",
    variant: "secondary",
  };
  if (!offer) {
    return preview.next
      ? [{ id: "start", label: "Offer to the next bidder…", variant: "primary" }, back]
      : [back];
  }
  switch (offer.status) {
    case "awaiting_seller":
      return [record, withdraw];
    case "ready":
      return [send, withdraw];
    case "offered":
      return [withdraw];
    case "accepted":
      return [];
    case "seller_lapsed":
      return [record, back];
    case "seller_declined":
      return [back];
    case "declined":
    case "expired":
    case "withdrawn":
      return canOfferAgain && preview.next ? [next, back] : [back];
  }
}

/** The notice's heading for each reason; its sentence is the shared copy. */
const NO_NEXT_BIDDER_TITLE: Record<NextBidderNoneReason, string> = {
  no_buyer: "No buyer to offer from",
  no_other_bidder: "No one else bid",
  no_eligible_bidder: "No one can be offered this lot",
  offer_limit_reached: "Three offers have been made",
};

function noNextBidder(reason: NextBidderNoneReason): { title: string; body: string } {
  return { title: NO_NEXT_BIDDER_TITLE[reason], body: NO_NEXT_BIDDER_COPY[reason] };
}

function noticeFor(
  offer: StaffReoffer | null,
  preview: ReofferPreview,
  canOfferAgain: boolean,
): ReofferCardModel["notice"] {
  const waitingForDecision =
    offer === null || ["declined", "expired", "withdrawn"].includes(offer.status);
  if (!waitingForDecision) return null;
  if (preview.next) {
    if (offer === null) return null;
    const lower = preview.next.bidMinor < offer.offerMinor;
    return {
      title: `Next in line: ${by(preview.next.accountName, "the next bidder")}, ${money(preview.next.bidMinor)}`,
      body: `Offer ${offer.sequence + 1} of up to ${MAX_REOFFERS_PER_DEFAULT}. The seller will be asked again${
        lower ? ", because the price is lower" : ""
      }.`,
    };
  }
  if (!canOfferAgain && offer) return noNextBidder("offer_limit_reached");
  return preview.noneReason ? noNextBidder(preview.noneReason) : null;
}

/**
 * What the Re-offer card shows for a lot after a buyer default: the badge, the four steps for the
 * offer in hand, a notice about who is next, and the actions its state and the person allow. All
 * of the card's words and choices come from here, so the component only draws them.
 */
export function buildReofferCard(input: Input): ReofferCardModel {
  const { offers, preview, access } = input;
  const current = offers.at(-1) ?? null;
  const progress = reofferProgress(
    offers.map((offer) => ({
      status: offer.status,
      offerSentAt: offer.offerSentAt ? new Date(offer.offerSentAt) : null,
    })),
  );
  const canOfferAgain = progress.kind === "needs_decision" && progress.canOfferAgain;

  const allowed = (action: ReofferAction) =>
    action.id === "record_answer" ? access.canRecordAnswer : access.canAct;
  const actions = actionsFor(current, preview, canOfferAgain).filter(allowed);
  const presentation = current ? REOFFER_STATUS_PRESENTATION[current.status] : null;
  const canChange = access.canAct || access.canRecordAnswer;

  return {
    badge: presentation,
    position: current ? `Offer ${current.sequence} of up to ${MAX_REOFFERS_PER_DEFAULT}` : null,
    steps: [
      defaultStep(input),
      sellerStep(current),
      offerStep(current, preview),
      acceptedStep(current),
    ],
    notice: noticeFor(current, preview, canOfferAgain),
    actions,
    readOnlyNote: canChange ? null : READ_ONLY_NOTE,
    current,
  };
}
