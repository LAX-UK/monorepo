import { bidderReofferHref } from "@/lib/reoffer/bidder-reoffer-links";
import { formatMoney } from "@/lib/ui/format";
import { LONDON_TIME_ZONE, formatDayMonth, formatWeekday, formatWhen } from "@auction/datetime";
import type { BidderReofferView } from "@auction/validators";

/**
 * What the offered bidder reads on the page of one offer to buy a lot at their own bid after the
 * buyer did not pay. The state follows the offer's own record; each state is one entry of
 * {@link STATES}, so a new state is a new row, never another branch. Nothing here names the
 * seller or the buyer who did not pay.
 */

export type BidderReofferState = "open" | "ended" | "declined" | "withdrawn" | "accepted";

export type BidderReofferChip = {
  tone: "info" | "success" | "neutral";
  label: string;
  /** `clock` draws the clock: the offer is open until a date. */
  cue: "clock" | "check" | "ring";
};

export type BidderReofferNotice = {
  tone: "info" | "warning" | "danger";
  title: string;
  detail: string;
};

export type BidderReofferCardVm = {
  state: BidderReofferState;
  /** What happened, once the offer is no longer open; the open offer reads as one sentence. */
  heading: string | null;
  /** The sentence the open offer opens with, the price set off from the rest. */
  lead: { before: string; amount: string; after: string } | null;
  paragraphs: string[];
  notice: BidderReofferNotice | null;
  /** The terms box and the two answers, for a member who may answer. */
  answerable: boolean;
  /** Where the offer leads once it was accepted. */
  purchaseHref: string | null;
  /** A way back to the sales, once the offer is over. */
  browse: boolean;
};

export type BidderReofferPriceVm = {
  rows: Array<{ label: string; value: string; strong?: boolean }>;
  note: string;
  /** The total in pence, sent with the accept so the server can refuse one that has changed. */
  totalMinor: number;
};

export type BidderReofferVm = {
  id: string;
  lotId: string;
  lotTitle: string;
  /** "Lot 2 · Modern & Contemporary: Online" and "Ended Thu 29 Oct". */
  lotMeta: string[];
  lotImage: string | null;
  /** The price offered, as the sheet that asks to decline repeats it. */
  offer: string;
  subtitle: string;
  chip: BidderReofferChip | null;
  /** "Ends in 6 hours": only in the last day. */
  endsIn: string | null;
  card: BidderReofferCardVm;
  price: BidderReofferPriceVm;
};

export type BidderReofferViewer = {
  /** The member may bid for the account, so may answer for it. */
  canAnswer: boolean;
  /** The organisation's name, or `null` for a person's own account. */
  organisation: string | null;
  /** The account still has an identity check to pass before it can pay. */
  identityCheckPending: boolean;
  /** The offer ended while the person was answering it. */
  endedWhileAnswering: boolean;
  /** The sale the lot was in, when it could be read. */
  saleTitle: string | null;
};

const HOUR_MS = 3_600_000;
const money = (minor: number) => formatMoney(minor / 100);
const at = (iso: string) => new Date(iso);
/** "Wed 11 Nov", with the year only when it is not this year's. */
const day = (iso: string, now: Date) =>
  `${formatWeekday(at(iso), LONDON_TIME_ZONE)} ${formatDayMonth(at(iso), LONDON_TIME_ZONE, now)}`;
/** "Sat 14 Nov, 17:00 GMT": the one moment style, in London time. */
const when = (iso: string, now: Date) => formatWhen(at(iso), LONDON_TIME_ZONE, now);

/** The state of the offer, from its record and the clock (the sweep closes it shortly after). */
export function bidderReofferState(view: BidderReofferView, now: Date): BidderReofferState {
  if (view.status === "offered" && at(view.endsAt).getTime() <= now.getTime()) return "ended";
  switch (view.status) {
    case "offered":
      return "open";
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "withdrawn":
      return "withdrawn";
    case "ended":
      return "ended";
  }
}

/** "Ends in 6 hours", counted in whole hours (minutes in the last hour); `null` beyond a day. */
export function endsInLabel(endsAt: string, now: Date): string | null {
  const left = at(endsAt).getTime() - now.getTime();
  if (left <= 0 || left > 24 * HOUR_MS) return null;
  if (left < HOUR_MS) {
    const minutes = Math.max(1, Math.ceil(left / 60_000));
    return `Ends in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  const hours = Math.ceil(left / HOUR_MS);
  return `Ends in ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

type Ctx = { view: BidderReofferView; viewer: BidderReofferViewer; now: Date };
type StateEntry = {
  chip: (ctx: Ctx) => BidderReofferChip | null;
  card: (ctx: Ctx) => Omit<BidderReofferCardVm, "state">;
};

const NOTHING_OWED = "You don't owe anything.";
const CLOSED_CARD = { lead: null, notice: null, answerable: false, purchaseHref: null } as const;

function openNotice({ viewer }: Ctx): BidderReofferNotice | null {
  if (!viewer.canAnswer) {
    return {
      tone: "info",
      title: viewer.organisation
        ? `Only members who can bid for ${viewer.organisation} can answer`
        : "You can't answer this offer",
      detail: "Ask an owner or admin of the account if you'd like it accepted.",
    };
  }
  if (viewer.identityCheckPending) {
    return {
      tone: "warning",
      title: "You'll need to verify your identity to pay",
      detail:
        "You can accept now. We'll ask for your details straight after, and payment opens once they're checked.",
    };
  }
  return null;
}

const STATES: Record<BidderReofferState, StateEntry> = {
  open: {
    chip: ({ view, now }) => ({
      tone: "info",
      label: `Ends ${when(view.endsAt, now)}`,
      cue: "clock",
    }),
    card: (ctx) => ({
      heading: null,
      lead: {
        before:
          "The winning bidder did not complete their purchase. We'd like to offer you the lot at your highest bid, ",
        amount: money(ctx.view.price.hammerMinor),
        after: ". You're not committed until you accept.",
      },
      paragraphs: [],
      notice: openNotice(ctx),
      answerable: ctx.viewer.canAnswer,
      purchaseHref: null,
      browse: false,
    }),
  },
  ended: {
    chip: () => ({ tone: "neutral", label: "Ended", cue: "ring" }),
    card: ({ view, viewer, now }) => ({
      ...CLOSED_CARD,
      heading: "This offer has ended",
      paragraphs: [`The offer ended on ${when(view.endsAt, now)}. ${NOTHING_OWED}`],
      notice: viewer.endedWhileAnswering
        ? {
            tone: "danger",
            title: "This offer has ended",
            detail: "It can no longer be accepted. Nothing has been charged.",
          }
        : null,
      browse: true,
    }),
  },
  declined: {
    chip: () => ({ tone: "neutral", label: "Declined", cue: "ring" }),
    card: () => ({
      ...CLOSED_CARD,
      heading: "You declined this offer",
      paragraphs: [`Thank you for letting us know. ${NOTHING_OWED}`],
      browse: true,
    }),
  },
  withdrawn: {
    chip: () => ({ tone: "neutral", label: "Withdrawn", cue: "ring" }),
    card: () => ({
      ...CLOSED_CARD,
      heading: "This offer has been withdrawn",
      paragraphs: [`We're sorry for the change of plan. ${NOTHING_OWED}`],
      browse: true,
    }),
  },
  accepted: {
    chip: () => ({ tone: "success", label: "Accepted", cue: "check" }),
    card: ({ view, now }) => ({
      ...CLOSED_CARD,
      heading: "You bought this lot",
      paragraphs: [
        view.invoiceDueAt
          ? `Your invoice of ${money(view.price.totalMinor)} is due by ${when(view.invoiceDueAt, now)}. You can pay by card or bank transfer from your purchases.`
          : `Your invoice of ${money(view.price.totalMinor)} is on its way. You can pay by card or bank transfer from your purchases.`,
      ],
      purchaseHref: `/purchases/${encodeURIComponent(view.lotId)}`,
      browse: false,
    }),
  },
};

/**
 * The figures the bidder agrees to: the lines the invoice will carry, then the total. A line the
 * invoice does not have is not drawn, never shown as nil.
 */
function priceOf(view: BidderReofferView): BidderReofferPriceVm {
  const { price } = view;
  const optional = (label: string, minor: number | null) =>
    minor === null ? [] : [{ label, value: money(minor) }];
  return {
    rows: [
      { label: "Hammer (your bid)", value: money(price.hammerMinor) },
      ...optional("Buyer's premium", price.buyersPremiumMinor),
      ...optional("VAT on the buyer's premium", price.vatOnPremiumMinor),
      ...optional("VAT on the lot", price.vatOnLotMinor),
      ...optional("Artist's Resale Right", price.artistsResaleRightMinor),
      { label: "Total", value: money(price.totalMinor), strong: true },
    ],
    note: "Delivery or collection is arranged after you pay, as for any purchase.",
    totalMinor: price.totalMinor,
  };
}

export function bidderReofferVm(
  view: BidderReofferView,
  viewer: BidderReofferViewer,
  now: Date,
): BidderReofferVm {
  const state = bidderReofferState(view, now);
  const entry = STATES[state];
  const ctx: Ctx = { view, viewer, now };
  const lot = view.lotNumber === null ? "Lot" : `Lot ${view.lotNumber}`;
  return {
    id: view.id,
    lotId: view.lotId,
    lotTitle: view.lotTitle,
    lotMeta: [
      viewer.saleTitle ? `${lot} · ${viewer.saleTitle}` : lot,
      `Ended ${day(view.lotEndedAt, now)}`,
    ],
    lotImage: view.lotImage,
    offer: money(view.price.hammerMinor),
    subtitle: "After the auction, at your bid",
    chip: entry.chip(ctx),
    endsIn: state === "open" ? endsInLabel(view.endsAt, now) : null,
    card: { state, ...entry.card(ctx) },
    price: priceOf(view),
  };
}

/** A row of the offers pinned above Bids: the work, the price and when it ends. */
export type BidderReofferRowVm = {
  id: string;
  href: string;
  title: string;
  image: string | null;
  /** "Lot 2 · Modern & Contemporary: Online". */
  meta: string[];
  /** "£82,000.00": the bid the offer is made at. */
  offerLabel: string;
  /** "Ends Sat 14 Nov, 17:00 GMT". */
  ends: string;
};

/** Every offer still open, soonest to end first: they wait on the bidder, so they all show. */
export function bidderReofferRows(
  views: readonly BidderReofferView[],
  now: Date,
  saleTitleById: Readonly<Record<string, string>> = {},
): BidderReofferRowVm[] {
  return views
    .filter((view) => bidderReofferState(view, now) === "open")
    .sort((a, b) => at(a.endsAt).getTime() - at(b.endsAt).getTime())
    .map((view) => {
      const lot = view.lotNumber === null ? "Lot" : `Lot ${view.lotNumber}`;
      const sale = view.saleId ? saleTitleById[view.saleId] : undefined;
      return {
        id: view.id,
        href: bidderReofferHref(view.id),
        title: view.lotTitle,
        image: view.lotImage,
        meta: [sale ? `${lot} · ${sale}` : lot],
        offerLabel: money(view.price.hammerMinor),
        ends: `Ends ${when(view.endsAt, now)}`,
      };
    });
}
