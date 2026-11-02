import type { BidDialogState } from "@/lib/lot-page/bid-dialog/bid-dialog-state";
import {
  type BidMode,
  type BidNotice,
  type BuyersPremiumTerms,
  type NextBidLot,
  bidFailureNotice,
  bidSummary,
  isLargeMaximum,
  limitCovers,
  noticeBlocksConfirm,
  snapTypedMaximum,
} from "@auction/domain";

type Money = { money(amount: string): string };

export type BidDialogViewInput = {
  state: BidDialogState;
  lot: { lotNumber: number | null; title: string; artistName: string | null };
  /** The amounts offered for a maximum, already within an agent's limit. */
  ladder: readonly string[];
  modes: readonly BidMode[];
  terms: BuyersPremiumTerms | null;
  /** What an agent has left under their limit for this sale; `null` when no limit applies. */
  agentLimitLeft: string | null;
  /** The organisation the bid is for; `null` when bidding as a person. */
  accountName: string | null;
  /** The lot has not opened: a maximum is left to be bid from the opening. */
  scheduled: boolean;
  /** The lot at its price now, and what a very large maximum is measured against. */
  pricing: { lot: NextBidLot; estimateHigh: string | null };
  format: Money;
};

export type BidDialogOption = { value: BidMode; label: string; description: string };

export type BidDialogSummary = {
  rows: readonly { label: string; value: string }[];
  total: { label: string; value: string };
  fine: string;
};

export type BidDialogConfirm =
  | { kind: "none" }
  | { kind: "ready"; label: string }
  | { kind: "retry"; label: string }
  | { kind: "submitting"; label: string }
  | { kind: "disabled"; label: string; reason: string };

export type BidDialogView = {
  title: string;
  description: string;
  /** The choice between the two ways to bid; `null` when only one way is open. */
  options: readonly BidDialogOption[] | null;
  /** The maximum field and its choices; `null` while the next bid is chosen. */
  maximum: {
    entry: "choose" | "type";
    value: string | null;
    choices: readonly { value: string; label: string }[];
    typedText: string;
    /** Why the typed amount can't be used. */
    error: string | null;
    /** "Your maximum will be £49,500, the nearest valid step": said before confirming. */
    snapNote: string | null;
    /** A very large amount waiting for the bidder to say they meant it. */
    large: { amount: string } | null;
  } | null;
  accountNote: { title: string; detail: string | null } | null;
  notice: BidNotice | null;
  summary: BidDialogSummary | null;
  confirm: BidDialogConfirm;
  /** Cancel reads "Close" once there is nothing left to confirm. */
  cancelLabel: string;
  /** The amount the confirm button names, which is also what the summary works from. */
  amount: string | null;
};

const OPTION_COPY: Readonly<Record<BidMode, (input: BidDialogViewInput) => BidDialogOption>> = {
  next: ({ state, format }) => ({
    value: "next",
    label: `Bid ${format.money(state.shownNextBid)}`,
    description: "The next bid. You lead straight away unless someone has a higher maximum.",
  }),
  maximum: () => ({
    value: "maximum",
    label: "Set a maximum bid",
    description: "We bid for you, one step at a time, only as much as needed to keep you ahead.",
  }),
};

function lotLine(lot: BidDialogViewInput["lot"]): string {
  return [lot.lotNumber !== null ? `Lot ${lot.lotNumber}` : null, lot.title, lot.artistName]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function typedOf(input: BidDialogViewInput) {
  const { state } = input;
  return state.mode === "maximum" && state.entry === "type"
    ? snapTypedMaximum(input.pricing.lot, state.typedText)
    : null;
}

/** The amount in play: the next bid, or the chosen or typed maximum (snapped to a step). */
function amountOf(input: BidDialogViewInput, typed: ReturnType<typeof typedOf>): string | null {
  const { state } = input;
  if (typed) return typed.kind === "ok" ? typed.snapped : null;
  return state.mode === "maximum" ? state.maximum : state.shownNextBid;
}

/** An agent whose limit cannot cover the bid is told before pressing, not after. */
function limitFailure(
  input: BidDialogViewInput,
  amount: string | null,
  typed: ReturnType<typeof typedOf>,
) {
  if (input.agentLimitLeft === null) return null;
  if (typed && typed.kind !== "ok") return null;
  const covered = typed
    ? amount !== null && limitCovers(input.agentLimitLeft, amount)
    : input.state.mode === "maximum"
      ? input.ladder.length > 0
      : amount !== null && limitCovers(input.agentLimitLeft, amount);
  return covered
    ? null
    : ({
        kind: "refused",
        refusal: { code: "over_limit", details: { remaining: input.agentLimitLeft } },
      } as const);
}

function summaryOf(input: BidDialogViewInput, amount: string | null): BidDialogSummary | null {
  if (amount === null || input.terms === null) return null;
  const { mode } = input.state;
  const sum = bidSummary(input.terms, amount);
  const premiumLabel = sum.percentLabel
    ? `Buyer's premium (${sum.percentLabel})`
    : "Buyer's premium";
  return {
    rows: [
      {
        label: mode === "maximum" ? "Your maximum" : "Your bid",
        value: input.format.money(sum.hammer),
      },
      { label: premiumLabel, value: input.format.money(sum.premium) },
    ],
    total: {
      label: mode === "maximum" ? "Most you would pay" : "Total if you win",
      value: input.format.money(sum.total),
    },
    fine: "Plus delivery, quoted when you pay. Bids are binding.",
  };
}

function submittingLabel(input: BidDialogViewInput): string {
  if (input.state.mode === "next") return "Placing your bid…";
  return input.scheduled ? "Saving your maximum…" : "Setting your maximum…";
}

function confirmOf(
  input: BidDialogViewInput,
  amount: string | null,
  notice: BidNotice | null,
  held: string | null,
): BidDialogConfirm {
  const { state, format } = input;
  if (state.phase === "submitting" || state.phase === "placed") {
    return { kind: "submitting", label: submittingLabel(input) };
  }
  if (notice?.remedy.kind === "close") return { kind: "none" };
  if (amount === null) {
    return {
      kind: "disabled",
      label: "Confirm maximum",
      reason: held ?? "No amount is available to choose.",
    };
  }
  if (held) {
    return {
      kind: "disabled",
      label: `Confirm maximum of ${format.money(amount)}`,
      reason: held,
    };
  }
  if (notice && noticeBlocksConfirm(notice)) {
    return {
      kind: "disabled",
      label:
        state.mode === "next"
          ? `Confirm bid of ${format.money(amount)}`
          : `Confirm maximum of ${format.money(amount)}`,
      reason: notice.title,
    };
  }
  if (notice?.remedy.kind === "retry") return { kind: "retry", label: "Try again" };
  return {
    kind: "ready",
    label:
      state.mode === "next"
        ? `Confirm bid of ${format.money(amount)}`
        : `Confirm maximum of ${format.money(amount)}`,
  };
}

/**
 * What is left of the limit, from one source: when the server has just refused a bid as over the
 * limit, its figure is the freshest and replaces the one read with the page.
 */
function limitLeftOf(input: BidDialogViewInput): string | null {
  const { failure } = input.state;
  if (failure?.kind === "refused" && failure.refusal.code === "over_limit") {
    return failure.refusal.details.remaining ?? input.agentLimitLeft;
  }
  return input.agentLimitLeft;
}

function accountNoteOf(input: BidDialogViewInput): BidDialogView["accountNote"] {
  if (!input.accountName) return null;
  const left = limitLeftOf(input);
  return {
    title: `Bidding for ${input.accountName}`,
    detail: left !== null ? `${input.format.money(left)} left of your limit for this sale.` : null,
  };
}

/**
 * Everything the bid dialog shows for a state, decided in one place: the words, which choices are
 * open, what the summary works out and what the confirm button says and can do. Pure, so every
 * state of the dialog is a test and the component only draws it.
 */
/** The typed maximum's own words: why it can't be used, what it snaps to, whether to ask again. */
function typedField(input: BidDialogViewInput, typed: NonNullable<ReturnType<typeof typedOf>>) {
  const { format, state } = input;
  switch (typed.kind) {
    case "empty":
      return { error: null, snapNote: null, large: null, held: "Type an amount to continue." };
    case "invalid":
      return {
        error: "Enter an amount in pounds, for example 9,000.",
        snapNote: null,
        large: null,
        held: "Enter a valid amount to continue.",
      };
    case "below_next": {
      const error = `Enter at least ${format.money(typed.nextBid)}, the next bid.`;
      return { error, snapNote: null, large: null, held: error };
    }
    case "ok": {
      const large =
        isLargeMaximum({
          amount: typed.snapped,
          estimateHigh: input.pricing.estimateHigh,
          nextBid: nextBidOfLot(input),
        }) && !state.largeConfirmed
          ? { amount: typed.snapped }
          : null;
      return {
        error: null,
        snapNote: typed.exact
          ? null
          : `Your maximum will be ${format.money(typed.snapped)}, the nearest valid step.`,
        large,
        held: large ? "Confirm this large amount first." : null,
      };
    }
  }
}

function nextBidOfLot(input: BidDialogViewInput): string {
  return input.state.shownNextBid;
}

/**
 * Everything the bid dialog shows for a state, decided in one place: the words, which choices are
 * open, what the summary works out and what the confirm button says and can do. Pure, so every
 * state of the dialog is a test and the component only draws it.
 */
export function buildBidDialogView(input: BidDialogViewInput): BidDialogView {
  const { state, format } = input;
  const typed = typedOf(input);
  const field = typed ? typedField(input, typed) : null;
  const amount = amountOf(input, typed);
  const failure = state.failure ?? limitFailure(input, amount, typed);
  const notice = failure ? bidFailureNotice(failure, { mode: state.mode, format }) : null;
  const choosable = input.modes.length > 1;
  return {
    title: state.mode === "maximum" ? "Set a maximum bid" : "Place a bid",
    description: lotLine(input.lot),
    options: choosable ? input.modes.map((mode) => OPTION_COPY[mode](input)) : null,
    maximum:
      state.mode === "maximum"
        ? {
            entry: state.entry,
            value: state.maximum,
            choices: input.ladder.map((value) => ({ value, label: format.money(value) })),
            typedText: state.typedText,
            error: field?.error ?? null,
            snapNote: field?.snapNote ?? null,
            large: field?.large ?? null,
          }
        : null,
    accountNote: accountNoteOf(input),
    notice,
    summary: notice?.remedy.kind === "close" ? null : summaryOf(input, amount),
    confirm: confirmOf(input, amount, notice, field?.held ?? null),
    cancelLabel: notice?.remedy.kind === "close" ? "Close" : "Cancel",
    amount,
  };
}
