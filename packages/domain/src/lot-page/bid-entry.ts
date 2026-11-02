import type { LotAuctionType } from "@auction/types";
import { limitCovers } from "./bid-ladder.js";
import type { LotLifecycleKind } from "./lifecycle-copy.js";
import type { ResolvedLotAction } from "./lot-action.js";
import type { LotPosition } from "./viewer-state.js";

/** The two ways to bid in the dialog. */
export type BidMode = "next" | "maximum";

const MAXIMUM_AUCTION_TYPES: ReadonlySet<LotAuctionType> = new Set(["english", "buy_it_now"]);

/**
 * The ways a lot can be bid on right now. Before a lot opens only a maximum can be left; an
 * auction that has no proxy bidding takes the next bid alone.
 */
export function bidModesFor(input: {
  lifecycle: LotLifecycleKind;
  auctionType: LotAuctionType;
}): readonly BidMode[] {
  if (!MAXIMUM_AUCTION_TYPES.has(input.auctionType)) return ["next"];
  return input.lifecycle === "scheduled" ? ["maximum"] : ["next", "maximum"];
}

/** Where a control that is not a bid takes the person. */
export type BidEntryDestination = "sign_in" | "register" | "client_services" | "ask_admin";

export type BidEntryControl =
  | { kind: "open_dialog"; start: BidMode; label: string }
  | { kind: "go"; to: BidEntryDestination; label: string };

export type BidEntryHelp = {
  text: string;
  /** Whether "How bidding works" follows the text. */
  withBiddingGuide: boolean;
};

/** The action area of a lot the viewer can take part in: what to press, and why not when they can't. */
export type BidEntry = {
  /** The one main button; `disabledReason` says why it cannot be pressed. */
  primary: { control: BidEntryControl; disabledReason: string | null } | null;
  /** A quieter full-width button, for someone already leading. */
  secondary: BidEntryControl | null;
  /** A text link under the buttons. */
  alt: BidEntryControl | null;
  help: BidEntryHelp | null;
};

export type BidEntryInput = {
  action: ResolvedLotAction;
  lifecycle: LotLifecycleKind;
  auctionType: LotAuctionType;
  position: LotPosition;
  nextBid: string | null;
  /** What an agent has left under their limit for this sale; `null` when no limit applies. */
  agentLimitLeft: string | null;
  /** "25%": the buyer's premium as the page prints it. */
  premiumPercent: string | null;
  format: { money(amount: string): string };
};

const EMPTY: BidEntry = { primary: null, secondary: null, alt: null, help: null };

const SIGN_IN_HELP =
  "New to LAX Bid? Create a LAX Account, then register for this sale. It takes about two minutes.";
const REGISTER_HELP = "Register once for this sale. We check your identity the first time only.";
const PENDING_REASON = "You can bid once your registration is approved.";
const PAUSED_REASON = "Bidding resumes when the auctioneer restarts the sale.";
const OVER_LIMIT_REASON = "Ask an organisation admin to raise your limit.";

type Builder = (input: BidEntryInput) => BidEntry;

function go(to: BidEntryDestination, label: string): BidEntryControl {
  return { kind: "go", to, label };
}

function openDialog(start: BidMode, label: string): BidEntryControl {
  return { kind: "open_dialog", start, label };
}

/** The label of the main bid button: the next amount, or a maximum when only that can be left. */
function bidLabelOf(input: BidEntryInput): { label: string; start: BidMode } {
  const modes = bidModesFor(input);
  if (modes[0] === "maximum" || !input.nextBid) {
    return { label: "Set a maximum bid", start: "maximum" };
  }
  return { label: `Bid ${input.format.money(input.nextBid)}`, start: "next" };
}

function biddingHelp(input: BidEntryInput): BidEntryHelp | null {
  if (input.lifecycle === "scheduled" || !input.premiumPercent) return null;
  return {
    text: `${input.premiumPercent} buyer's premium is added to the hammer price.`,
    withBiddingGuide: true,
  };
}

function altMaximum(input: BidEntryInput): BidEntryControl | null {
  return bidModesFor(input).includes("maximum") && bidModesFor(input)[0] !== "maximum"
    ? openDialog("maximum", "Set a maximum bid")
    : null;
}

/** An agent whose limit cannot cover even the next bid cannot bid; the reason says what to do. */
function overLimit(input: BidEntryInput): boolean {
  return input.nextBid !== null && !limitCovers(input.agentLimitLeft, input.nextBid);
}

/** A bidder who may bid: what they see depends on where they stand on the lot. */
const BIDDER_BY_POSITION: Partial<Record<LotPosition, Builder>> = {
  leading: (input) => ({
    ...EMPTY,
    secondary: bidModesFor(input).includes("maximum")
      ? openDialog("maximum", "Set a maximum bid")
      : null,
  }),
  maximum_set: () => ({
    ...EMPTY,
    secondary: openDialog("maximum", "Change your maximum"),
  }),
};

function bidderEntry(input: BidEntryInput): BidEntry {
  const byPosition = BIDDER_BY_POSITION[input.position];
  if (byPosition) return byPosition(input);
  const { label, start } = bidLabelOf(input);
  if (overLimit(input)) {
    return {
      primary: { control: openDialog(start, label), disabledReason: OVER_LIMIT_REASON },
      secondary: null,
      alt: go("ask_admin", "Ask an admin"),
      help: null,
    };
  }
  return {
    primary: { control: openDialog(start, label), disabledReason: null },
    secondary: null,
    alt: altMaximum(input),
    help: biddingHelp(input),
  };
}

/** One row per action the domain can resolve to, so a new action is a new row. */
const ENTRY_BY_ACTION: Readonly<Partial<Record<ResolvedLotAction, Builder>>> = {
  sign_in: (input) => ({
    ...EMPTY,
    primary: {
      control: go(
        "sign_in",
        input.lifecycle === "scheduled" ? "Sign in to register" : "Sign in to bid",
      ),
      disabledReason: null,
    },
    help: { text: SIGN_IN_HELP, withBiddingGuide: false },
  }),
  register: () => ({
    ...EMPTY,
    primary: { control: go("register", "Register to bid"), disabledReason: null },
    help: { text: REGISTER_HELP, withBiddingGuide: false },
  }),
  registration_pending: (input) => ({
    ...EMPTY,
    primary: {
      control: openDialog(bidLabelOf(input).start, bidLabelOf(input).label),
      disabledReason: PENDING_REASON,
    },
  }),
  registration_declined: () => ({
    ...EMPTY,
    secondary: go("client_services", "Contact client services"),
  }),
  bid: bidderEntry,
  bid_and_watch_saleroom: bidderEntry,
  set_maximum: bidderEntry,
  bid_disabled: (input) => {
    const { label, start } = bidLabelOf(input);
    return {
      ...EMPTY,
      primary: { control: openDialog(start, label), disabledReason: PAUSED_REASON },
    };
  },
};

/** What the action area of a bidding lot offers the viewer; nothing for an action that isn't bidding. */
export function buildBidEntry(input: BidEntryInput): BidEntry {
  return ENTRY_BY_ACTION[input.action]?.(input) ?? EMPTY;
}
