import { reofferConsentLine } from "@/lib/seller/seller-commission.vm";
import { formatMoney } from "@/lib/ui/format";
import { LONDON_TIME_ZONE, formatDayMonth, formatWeekday, formatWhen } from "@auction/datetime";
import { ratePercentLabel } from "@auction/domain";
import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";
import type { SellerReofferProceeds, SellerReofferView } from "@auction/validators";

/**
 * What a seller reads on the page of one request to sell their lot at the next bidder's price
 * after the buyer did not pay. The state follows the request's own record; each state is one entry
 * of {@link STATES}, so a new state is a new row, never another branch. Nothing here names a bidder.
 */

export type SellerReofferState =
  | "waiting"
  | "agreed"
  | "sold"
  | "declined"
  | "lapsed"
  | "withdrawn"
  | "not_taken_up"
  | "not_needed";

export type SellerReofferChip = {
  tone: "warning" | "success" | "neutral";
  label: string;
  shape: "alert" | "check" | "ring";
};

export type SellerReofferNotice = { tone: "info" | "warning"; title: string; detail?: string };

export type SellerReofferCardVm = {
  state: SellerReofferState;
  heading: string;
  paragraphs: string[];
  /** The one line that says how the request stands for a member who cannot answer, or after. */
  notice: SellerReofferNotice | null;
  /** The buttons that answer, for a member who may. */
  answerable: boolean;
  /** A way to reach us, once the request has closed. */
  contact: boolean;
};

export type SellerReofferMoneyVm = {
  rows: Array<{ label: string; value: string; strong?: boolean }>;
  note: string;
};

export type SellerReofferVm = {
  id: string;
  lotTitle: string;
  /**
   * The price offered, and the line that says what the seller would receive under their signed
   * agreement, as the Agree sheet repeats them. The line is `null` for a member who does not see
   * the account's payouts.
   */
  offer: string;
  consent: string | null;
  /** "Lot 2 · ended Thu 29 Oct". */
  subtitle: string;
  chip: SellerReofferChip | null;
  card: SellerReofferCardVm;
  /**
   * Shown while the figures still matter to the seller, and only to a member who sees the
   * account's payouts; `null` otherwise.
   */
  money: SellerReofferMoneyVm | null;
};

export type SellerReofferViewer = {
  /** The member may answer: owners and admins, or the person themselves. */
  canAnswer: boolean;
  /** The organisation's name, or `null` for a person's own account. */
  organisation: string | null;
};

const money = (minor: number) => formatMoney(minor / 100);
/** "7 days": the buyer's payment term, the one every invoice is raised with. */
export const PAYMENT_TERM = `${INVOICE_PAYMENT_DUE_DAYS} days`;
const at = (iso: string) => new Date(iso);
/** "Wed 11 Nov", with the year only when it is not this year's. */
const day = (iso: string, now: Date) =>
  `${formatWeekday(at(iso), LONDON_TIME_ZONE)} ${formatDayMonth(at(iso), LONDON_TIME_ZONE, now)}`;
/** "Fri 13 Nov, 17:00 GMT": the one moment style, in London time. */
const when = (iso: string, now: Date) => formatWhen(at(iso), LONDON_TIME_ZONE, now);

/** The state of the request, from its offer and answer. */
export function sellerReofferState(view: SellerReofferView, now: Date): SellerReofferState {
  if (view.consentStatus === "not_needed") return "not_needed";
  switch (view.status) {
    case "awaiting_seller":
      // The clock lapses the request shortly after its deadline; until then it reads as closed.
      return view.answerDueAt && at(view.answerDueAt).getTime() <= now.getTime()
        ? "lapsed"
        : "waiting";
    case "ready":
    case "offered":
      return "agreed";
    case "accepted":
      return "sold";
    case "seller_declined":
      return "declined";
    case "seller_lapsed":
      return "lapsed";
    case "withdrawn":
      return "withdrawn";
    case "declined":
    case "expired":
      return "not_taken_up";
  }
}

type Ctx = { view: SellerReofferView; viewer: SellerReofferViewer; now: Date };
type StateEntry = {
  chip: (ctx: Ctx) => SellerReofferChip | null;
  card: (ctx: Ctx) => Omit<SellerReofferCardVm, "state">;
  /** Whether the proceeds still matter to the seller. */
  showMoney: boolean;
};

const NEXT_STEP: Record<NonNullable<SellerReofferView["declinePreference"]>, string> = {
  later_sale: "We'll talk to you about including it in a later sale.",
  return_to_me: "We'll arrange to return it to you.",
  talk_to_us: "We'll be in touch to talk it through.",
};

function waitingParagraphs({ view, viewer }: Ctx): string[] {
  const price = money(view.offerMinor);
  const intro = [
    `The winning bidder didn't pay for ${view.lotTitle}, so we cancelled that sale. Nothing is payable to you for it.`,
  ];
  // Below the reserve the notice carries the price, so the sentence is not said twice.
  if (!view.belowReserve) {
    intro.push(
      `The next highest bidder bid ${price}. With your agreement, we'll offer them the lot at that price. If they accept, they'll have ${PAYMENT_TERM} to pay.`,
    );
  }
  if (viewer.canAnswer) {
    intro.push(
      "If you'd rather not, we'll talk to you about including it in a later sale or returning it to you.",
    );
  } else if (viewer.organisation) {
    intro.push(`We've asked ${viewer.organisation} whether we may offer it to them.`);
  }
  return intro;
}

/** Below the reserve the seller must see it; a member who cannot answer is told who can. */
function waitingNotice({ view, viewer }: Ctx): SellerReofferNotice | null {
  if (!viewer.canAnswer) {
    return { tone: "info", title: "Only the account's owners and admins can answer" };
  }
  if (view.belowReserve) {
    return {
      tone: "warning",
      title: `This is below your reserve of ${money(view.reserveMinor ?? 0)}`,
      detail: `The next bid is ${money(view.offerMinor)}. We'll only offer it at this price if you agree.`,
    };
  }
  return null;
}

const STATES: Record<SellerReofferState, StateEntry> = {
  waiting: {
    showMoney: true,
    chip: ({ view, now }) =>
      view.answerDueAt
        ? { tone: "warning", label: `Answer by ${when(view.answerDueAt, now)}`, shape: "alert" }
        : null,
    card: (ctx) => ({
      heading: "The buyer didn't pay",
      paragraphs: waitingParagraphs(ctx),
      notice: waitingNotice(ctx),
      answerable: ctx.viewer.canAnswer,
      contact: false,
    }),
  },
  agreed: {
    showMoney: true,
    chip: ({ view, now }) =>
      view.answeredAt
        ? { tone: "success", label: `You agreed · ${day(view.answeredAt, now)}`, shape: "check" }
        : { tone: "success", label: "You agreed", shape: "check" },
    card: ({ view, now }) => ({
      heading: "We're offering it to the next bidder",
      paragraphs: [
        view.offerEndsAt
          ? `They have until ${when(view.offerEndsAt, now)} to accept. We'll tell you either way.`
          : "We'll send them the offer shortly. We'll tell you either way.",
      ],
      notice:
        view.answeredBy === "recorded_by_staff"
          ? {
              tone: "info",
              title: "Our team recorded your answer",
              detail: view.answeredAt
                ? `We noted it on ${day(view.answeredAt, now)}, from what you told us.`
                : "We noted it from what you told us.",
            }
          : null,
      answerable: false,
      contact: false,
    }),
  },
  sold: {
    showMoney: false,
    chip: () => ({ tone: "success", label: "Sold after the auction", shape: "check" }),
    card: ({ view, now }) => ({
      heading: `${view.lotTitle} has a new buyer`,
      paragraphs: [
        `Sold for ${money(view.offerMinor)}${view.soldAt ? ` on ${day(view.soldAt, now)}` : ""}. We'll pay you once their payment clears${view.proceeds ? `, about ${money(view.proceeds.offerProceedsMinor)}` : ""}.`,
      ],
      notice: null,
      answerable: false,
      contact: false,
    }),
  },
  declined: {
    showMoney: false,
    chip: ({ view, now }) => ({
      tone: "neutral",
      label: view.answeredAt
        ? `You said not this time · ${day(view.answeredAt, now)}`
        : "You said not this time",
      shape: "ring",
    }),
    card: ({ view, now }) => ({
      heading: "We won't offer it to the next bidder",
      paragraphs: [
        view.declinePreference
          ? NEXT_STEP[view.declinePreference]
          : "We'll be in touch about what happens next.",
      ],
      notice:
        view.answeredBy === "recorded_by_staff"
          ? {
              tone: "info",
              title: "Our team recorded your answer",
              detail: view.answeredAt
                ? `We noted it on ${day(view.answeredAt, now)}, from what you told us.`
                : "We noted it from what you told us.",
            }
          : null,
      answerable: false,
      contact: false,
    }),
  },
  lapsed: {
    showMoney: false,
    chip: () => ({ tone: "neutral", label: "No reply", shape: "ring" }),
    card: ({ view, now }) => ({
      heading: "This request has closed",
      paragraphs: [
        `We didn't hear from you${view.answerDueAt ? ` by ${when(view.answerDueAt, now)}` : ""}, so we haven't offered the lot. Our team will be in touch about what happens next.`,
      ],
      notice: null,
      answerable: false,
      contact: true,
    }),
  },
  withdrawn: {
    showMoney: false,
    chip: () => ({ tone: "neutral", label: "Withdrawn", shape: "ring" }),
    card: () => ({
      heading: "This request was withdrawn",
      paragraphs: [
        "We've withdrawn this request, so there is nothing for you to do. Our team will be in touch about what happens next.",
      ],
      notice: null,
      answerable: false,
      contact: true,
    }),
  },
  not_taken_up: {
    showMoney: false,
    chip: () => ({ tone: "neutral", label: "Offer not taken up", shape: "ring" }),
    card: ({ view }) => ({
      heading: `The next bidder didn't take up ${view.lotTitle}`,
      paragraphs: [
        `The next bidder ${view.status === "declined" ? "declined our offer" : "didn't answer in time"}. We'll be in touch about the next step, and we'll ask you before the lot is offered again.`,
      ],
      notice: null,
      answerable: false,
      contact: false,
    }),
  },
  not_needed: {
    showMoney: false,
    chip: () => null,
    card: () => ({
      heading: "Nothing to answer",
      paragraphs: ["We own this lot, so we don't need your agreement to offer it again."],
      notice: null,
      answerable: false,
      contact: false,
    }),
  },
};

/**
 * The seller's figures, from the proceeds worked out by the signed agreement's rule when the
 * request was made: the offer, less the commission and the VAT on it, is what the seller
 * receives. The buyer's premium is LAX's and never part of the seller's figures.
 */
function moneyOf(view: SellerReofferView, proceeds: SellerReofferProceeds): SellerReofferMoneyVm {
  const charges = view.offerMinor - proceeds.offerProceedsMinor;
  const shortfall = proceeds.originalProceedsMinor - proceeds.offerProceedsMinor;
  const rate =
    proceeds.commissionBps === null ? "" : ` (${ratePercentLabel(proceeds.commissionBps)})`;
  return {
    rows: [
      { label: "Offer to the next bidder", value: money(view.offerMinor) },
      { label: `Commission${rate} and VAT`, value: `−${money(charges)}` },
      { label: "You receive", value: money(proceeds.offerProceedsMinor), strong: true },
      {
        label: `At the original ${money(proceeds.originalHammerMinor)}`,
        value: money(proceeds.originalProceedsMinor),
      },
      ...(shortfall > 0 ? [{ label: "Difference", value: `−${money(shortfall)}` }] : []),
    ],
    note: consentLine(view, proceeds),
  };
}

function consentLine(view: SellerReofferView, proceeds: SellerReofferProceeds): string {
  return reofferConsentLine({
    offerMinor: view.offerMinor,
    proceedsMinor: proceeds.offerProceedsMinor,
    commissionBps: proceeds.commissionBps,
  });
}

export function sellerReofferVm(
  view: SellerReofferView,
  viewer: SellerReofferViewer,
  now: Date,
): SellerReofferVm {
  const state = sellerReofferState(view, now);
  const entry = STATES[state];
  const ctx: Ctx = { view, viewer, now };
  const lot = view.lotNumber === null ? "Lot" : `Lot ${view.lotNumber}`;
  return {
    id: view.id,
    lotTitle: view.lotTitle,
    offer: money(view.offerMinor),
    consent: view.proceeds ? consentLine(view, view.proceeds) : null,
    subtitle: `${lot} · ended ${day(view.lotEndedAt, now)}`,
    chip: entry.chip(ctx),
    card: { state, ...entry.card(ctx) },
    money: entry.showMoney && view.proceeds ? moneyOf(view, view.proceeds) : null,
  };
}

/** A row of Sold & payouts' list of requests: the work, how it stands and where it opens. */
export type SellerReofferRowVm = {
  id: string;
  title: string;
  meta: string[];
  offer: string;
  badge: SellerReofferChip;
};

const ROW_LABEL: Record<SellerReofferState, SellerReofferChip | null> = {
  waiting: { tone: "warning", label: "Needs your answer", shape: "alert" },
  agreed: { tone: "success", label: "You agreed", shape: "check" },
  sold: { tone: "success", label: "Sold after the auction", shape: "check" },
  declined: { tone: "neutral", label: "You said not this time", shape: "ring" },
  lapsed: { tone: "neutral", label: "No reply", shape: "ring" },
  withdrawn: { tone: "neutral", label: "Withdrawn", shape: "ring" },
  not_taken_up: { tone: "neutral", label: "Offer not taken up", shape: "ring" },
  not_needed: null,
};

/** How many finished requests the list keeps; every request that waits on the seller shows. */
const CLOSED_SHOWN = 3;

/** The list's rows: every request waiting on an answer, then the latest few that finished. */
export function sellerReofferRows(
  views: readonly SellerReofferView[],
  now: Date,
): SellerReofferRowVm[] {
  const rows = views.flatMap((view) => {
    const state = sellerReofferState(view, now);
    const badge = ROW_LABEL[state];
    if (!badge) return [];
    const lot = view.lotNumber === null ? "Lot" : `Lot ${view.lotNumber}`;
    return [
      {
        open: state === "waiting",
        row: {
          id: view.id,
          title: view.lotTitle,
          meta: [lot, `Ended ${day(view.lotEndedAt, now)}`],
          offer: money(view.offerMinor),
          badge,
        },
      },
    ];
  });
  const open = rows.filter((entry) => entry.open);
  const closed = rows.filter((entry) => !entry.open).slice(0, CLOSED_SHOWN);
  return [...open, ...closed].map((entry) => entry.row);
}
