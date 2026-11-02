import { PLACE_BID_ERROR_CODES, type TypedPlaceBidRefusal } from "./place-bid-refusal.js";

/** How a notice reads; the dialog maps each tone to its notice style. */
export type BidNoticeTone = "info" | "warning" | "danger";

/**
 * The one way forward a notice offers. The dialog acts on it; the notice never asks the bidder to
 * work out what to do next.
 */
export type BidRemedy =
  /** The next bid moved: the dialog shows the new amount and asks again. Nothing is raised silently. */
  | { kind: "reconfirm"; amount: string }
  /** The amount was not valid: offer the nearest valid one. */
  | { kind: "use_amount"; amount: string }
  /** The bidder is over their limit: choose less, or ask an admin to raise it. */
  | { kind: "limit_help" }
  /** The bidder has to register for the sale first. */
  | { kind: "register" }
  /** The connection dropped: the same bid can be sent again, and cannot be placed twice. */
  | { kind: "retry" }
  /** Nothing more can be done here; the dialog offers to close. */
  | { kind: "close" }
  /** The server gave its own words; the bidder can change the bid and try again. */
  | { kind: "none" };

export type BidNotice = {
  tone: BidNoticeTone;
  title: string;
  detail: string;
  remedy: BidRemedy;
};

/** Why a bid did not go through, in the shapes a bid dialog meets. */
export type BidFailure =
  | { kind: "refused"; refusal: TypedPlaceBidRefusal }
  /** The request left but no answer came back. */
  | { kind: "unreachable" }
  /** A refusal the dialog has no table row for; the server's own words are shown. */
  | { kind: "rejected"; message: string | null }
  /** Someone bid while the dialog was open, before the bidder confirmed. */
  | { kind: "moved"; seenNextBid: string; nextBid: string };

export type BidNoticeContext = {
  /** Whether the bidder was placing the next bid or setting a maximum. */
  mode: "next" | "maximum";
  format: { money(amount: string): string };
};

type NoticeBuilder = (failure: TypedPlaceBidRefusal, ctx: BidNoticeContext) => BidNotice;

function detailOf(refusal: TypedPlaceBidRefusal, key: string): string | null {
  const value = refusal.details[key];
  return value && value.trim() !== "" ? value : null;
}

/** One row per typed refusal, so a new refusal is a new row rather than another branch. */
const REFUSAL_NOTICES: Readonly<Record<string, NoticeBuilder>> = {
  [PLACE_BID_ERROR_CODES.outbid_during_confirm]: (refusal, ctx) => {
    const next = detailOf(refusal, "nextBidAmount");
    return movedNotice(null, next, ctx);
  },
  [PLACE_BID_ERROR_CODES.over_limit]: (refusal, ctx) => {
    const remaining = detailOf(refusal, "remaining");
    return {
      tone: "warning",
      title: "This bid is over your limit",
      detail: remaining
        ? `${ctx.format.money(remaining)} left of your limit for this sale. Choose a lower amount or ask an organisation admin to raise it.`
        : "Ask an organisation admin to raise your limit for this sale.",
      remedy: { kind: "limit_help" },
    };
  },
  [PLACE_BID_ERROR_CODES.registration_required]: () => ({
    tone: "warning",
    title: "Register to bid on this sale",
    detail: "You need to be registered for this sale before you can bid.",
    remedy: { kind: "register" },
  }),
  [PLACE_BID_ERROR_CODES.registration_pending]: () => ({
    tone: "info",
    title: "Registration pending",
    detail: "We'll email you when you're approved, usually within one working day.",
    remedy: { kind: "close" },
  }),
  [PLACE_BID_ERROR_CODES.lot_closed]: () => ({
    tone: "info",
    title: "Bidding has closed on this lot",
    detail: "Your bid wasn't placed. The result will show on the lot page in a moment.",
    remedy: { kind: "close" },
  }),
  [PLACE_BID_ERROR_CODES.amount_invalid]: (refusal, ctx) => {
    const nearest = detailOf(refusal, "nearestValidAmount");
    return nearest
      ? {
          tone: "warning",
          title: "That amount isn't available",
          detail: `The nearest valid amount is ${ctx.format.money(nearest)}.`,
          remedy: { kind: "use_amount", amount: nearest },
        }
      : {
          tone: "warning",
          title: "That amount isn't available",
          detail: "Choose one of the amounts offered.",
          remedy: { kind: "none" },
        };
  },
};

/**
 * "Someone bid £7,250 first": the next bid moved under the bidder, either while the dialog was
 * open or between pressing confirm and the server's answer. The bidder is told the amount they
 * saw and the amount now needed, and decides again.
 */
function movedNotice(
  seenNextBid: string | null,
  nextBid: string | null,
  ctx: BidNoticeContext,
): BidNotice {
  const seen = seenNextBid ? ctx.format.money(seenNextBid) : null;
  if (!nextBid) {
    return {
      tone: "warning",
      title: seen ? `Someone bid ${seen} first` : "Someone bid first",
      detail: "The next bid has moved. Check the amount, then confirm.",
      remedy: { kind: "none" },
    };
  }
  return {
    tone: "warning",
    title: seen ? `Someone bid ${seen} first` : "Someone bid first",
    detail:
      ctx.mode === "maximum"
        ? `The next bid is now ${ctx.format.money(nextBid)}. Check your maximum, then confirm.`
        : `The next bid is now ${ctx.format.money(nextBid)}. Confirm if you'd like to bid it.`,
    remedy: { kind: "reconfirm", amount: nextBid },
  };
}

/** The notice a bid dialog shows for a failure, with the one remedy it offers. */
export function bidFailureNotice(failure: BidFailure, ctx: BidNoticeContext): BidNotice {
  switch (failure.kind) {
    case "refused": {
      const build = REFUSAL_NOTICES[failure.refusal.code];
      if (build) return build(failure.refusal, ctx);
      return rejectedNotice(null);
    }
    case "unreachable":
      return {
        tone: "danger",
        title: "We couldn't confirm your bid",
        detail:
          "Your connection dropped before we heard back. Try again: we'll never place the same bid twice.",
        remedy: { kind: "retry" },
      };
    case "moved":
      return movedNotice(failure.seenNextBid, failure.nextBid, ctx);
    case "rejected":
      return rejectedNotice(failure.message);
  }
}

function rejectedNotice(message: string | null): BidNotice {
  return {
    tone: "danger",
    title: "We couldn't place your bid",
    detail: message?.trim() || "Something went wrong on our side. Try again in a moment.",
    remedy: { kind: "none" },
  };
}

/** Whether the notice leaves the bid unable to go ahead until the bidder changes something. */
export function noticeBlocksConfirm(notice: BidNotice): boolean {
  switch (notice.remedy.kind) {
    case "limit_help":
    case "register":
    case "close":
      return true;
    default:
      return false;
  }
}
