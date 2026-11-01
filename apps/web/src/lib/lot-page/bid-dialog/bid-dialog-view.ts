import type { BidDialogState } from "@/lib/lot-page/bid-dialog/bid-dialog-state";
import {
  type BidMode,
  type BidNotice,
  type BuyersPremiumTerms,
  bidFailureNotice,
  bidSummary,
  limitCovers,
  noticeBlocksConfirm,
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
  maximum: { value: string | null; choices: readonly { value: string; label: string }[] } | null;
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

/** The amount in play: the next bid, or the chosen maximum. */
function amountOf(input: BidDialogViewInput): string | null {
  const { state } = input;
  return state.mode === "maximum" ? state.maximum : state.shownNextBid;
}

/** An agent whose limit cannot cover the bid is told before pressing, not after. */
function limitFailure(input: BidDialogViewInput, amount: string | null) {
  if (input.agentLimitLeft === null) return null;
  const covered =
    input.state.mode === "maximum"
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
      reason: "No amount is available to choose.",
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
export function buildBidDialogView(input: BidDialogViewInput): BidDialogView {
  const { state, format } = input;
  const amount = amountOf(input);
  const failure = state.failure ?? limitFailure(input, amount);
  const notice = failure ? bidFailureNotice(failure, { mode: state.mode, format }) : null;
  const choosable = input.modes.length > 1;
  return {
    title: state.mode === "maximum" ? "Set a maximum bid" : "Place a bid",
    description: lotLine(input.lot),
    options: choosable ? input.modes.map((mode) => OPTION_COPY[mode](input)) : null,
    maximum:
      state.mode === "maximum"
        ? {
            value: state.maximum,
            choices: input.ladder.map((value) => ({ value, label: format.money(value) })),
          }
        : null,
    accountNote: accountNoteOf(input),
    notice,
    summary: notice?.remedy.kind === "close" ? null : summaryOf(input, amount),
    confirm: confirmOf(input, amount, notice),
    cancelLabel: notice?.remedy.kind === "close" ? "Close" : "Cancel",
    amount,
  };
}
