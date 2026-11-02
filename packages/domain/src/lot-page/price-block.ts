import { moneyGt, moneyGte, parseMoneyToMinorUnits } from "../money-compare.js";
import {
  type LotLifecycleKind,
  type LotStatusTone,
  lotHeadlineLabel,
  lotLifecycleCopy,
} from "./lifecycle-copy.js";
import type { LotViewerState } from "./viewer-state.js";

/** The icon that accompanies a tone, so colour is never the only signal. */
export type StateLineIcon = "tick" | "alert" | "dot";

export type StateLine = {
  text: string;
  tone: LotStatusTone;
  icon: StateLineIcon;
};

export type LotEstimate = { low: string; high: string };

/** Formatting the caller owns: the domain never decides a currency or a locale. */
export type PriceBlockFormat = {
  /** A decimal major-unit string as money ("£7,250"). */
  money(amount: string): string;
  /** An ISO instant as a short date ("Tue 10 Nov"); optional until a formatter is wired. */
  date?(iso: string): string;
};

export type PriceBlockPurchase = {
  status: "not_invoiced" | "due" | "overdue" | "processing" | "paid" | "refunded" | "cancelled";
  dueAt: string | null;
};

export type PriceBlockInput = {
  lifecycle: LotLifecycleKind;
  amounts: {
    starting: string;
    current: string;
    /** Public on ended sold lots. */
    hammer: string | null;
    soldForWithPremium: string | null;
  };
  estimate: LotEstimate | null;
  bidCount: number;
  reserve: "met" | "below" | "none";
  /** The next valid bid while bidding is open. */
  nextBid: string | null;
  /** The extension a late bid added, when the lot was extended. */
  extendedByMs: number | null;
  /** In-the-room lots: whether this lot is on the block, or how far away it is. */
  saleroom: { onBlock: boolean; lotsAway: number | null } | null;
  signedIn: boolean;
  /** Whether the viewer must register for the sale before bidding (buyer agents). */
  registrationRequired: boolean;
  viewer: LotViewerState;
  purchase: PriceBlockPurchase | null;
  /** What an agent has left under their limit for this sale; `null` when no limit applies. */
  agentLimitLeft: string | null;
  format: PriceBlockFormat;
};

export type PriceBlockVM = {
  /** The label above the headline figure. */
  label: string;
  /** The headline figure as a decimal string; `null` when there is none to show. */
  amount: string | null;
  /** The headline as the page prints it ("£7,250", "£6,000–£9,000"); `null` when none. */
  amountText: string | null;
  /** The fact line under the headline. */
  subLine: string | null;
  /** The viewer's own position, in words, tone and shape. */
  stateLine: StateLine | null;
  /** "£1,500 left of your limit", for buyer agents. */
  agentLine: StateLine | null;
  /** The tone of the strongest line in the block. */
  tone: LotStatusTone;
};

const NO_PRICE_SUBLINE: Partial<Record<LotLifecycleKind, string>> = {
  withdrawn: "This lot was withdrawn from the sale",
  cancelled: "This lot was cancelled",
};

function isPositive(amount: string | null): amount is string {
  return amount !== null && moneyGt(amount, "0");
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The buyer's premium as a percentage the page can print, from the two figures it knows. */
export function premiumPercentLabel(hammer: string, soldForWithPremium: string): string | null {
  const hammerMinor = Number(parseMoneyToMinorUnits(hammer));
  const totalMinor = Number(parseMoneyToMinorUnits(soldForWithPremium));
  if (hammerMinor <= 0 || totalMinor <= hammerMinor) return null;
  const percent = ((totalMinor - hammerMinor) / hammerMinor) * 100;
  return `${Number(percent.toFixed(2))}%`;
}

function estimateText(estimate: LotEstimate, format: PriceBlockFormat): string {
  return `${format.money(estimate.low)}–${format.money(estimate.high)}`;
}

type Headline = Pick<PriceBlockVM, "label" | "amount" | "amountText" | "subLine">;

function openSubLine(input: PriceBlockInput): string | null {
  const parts: string[] = [];
  parts.push(input.bidCount > 0 ? plural(input.bidCount, "bid") : "No bids yet");
  if (input.reserve === "met") parts.push("Reserve met");
  if (input.reserve === "below") parts.push("Reserve not yet met");
  return parts.join(" · ");
}

function extendedSubLine(input: PriceBlockInput): string {
  if (input.extendedByMs && input.extendedByMs >= 1000) {
    const seconds = Math.round(input.extendedByMs / 1000);
    const text = seconds % 60 === 0 ? plural(seconds / 60, "minute") : plural(seconds, "second");
    return `Extended by ${text} after a late bid`;
  }
  return "Bidding was extended after a late bid";
}

function saleroomSubLine(input: PriceBlockInput): string | null {
  const room = input.saleroom;
  if (!room) return openSubLine(input);
  if (room.onBlock) return "On the block now";
  if (room.lotsAway !== null && room.lotsAway > 0) return `${plural(room.lotsAway, "lot")} away`;
  return openSubLine(input);
}

function headlineWithAmount(
  label: string,
  amount: string | null,
  subLine: string | null,
  format: PriceBlockFormat,
): Headline {
  if (!isPositive(amount)) return { label, amount: null, amountText: null, subLine };
  return { label, amount, amountText: format.money(amount), subLine };
}

function soldHeadline(input: PriceBlockInput): Headline {
  const { hammer, soldForWithPremium } = input.amounts;
  const { format } = input;
  const hammerAmount = isPositive(hammer)
    ? hammer
    : isPositive(input.amounts.current)
      ? input.amounts.current
      : null;
  if (isPositive(soldForWithPremium) && hammerAmount && moneyGt(soldForWithPremium, hammerAmount)) {
    const percent = premiumPercentLabel(hammerAmount, soldForWithPremium);
    const subLine = percent
      ? `Hammer ${format.money(hammerAmount)} plus ${percent} buyer's premium`
      : `Hammer ${format.money(hammerAmount)} plus buyer's premium`;
    return headlineWithAmount("Sold for", soldForWithPremium, subLine, format);
  }
  // No premium to report: the hammer is the whole price, and the label says so.
  return headlineWithAmount(
    hammerAmount && !isPositive(soldForWithPremium) ? "Hammer price" : "Sold for",
    isPositive(soldForWithPremium) ? soldForWithPremium : hammerAmount,
    null,
    format,
  );
}

function unsoldHeadline(input: PriceBlockInput): Headline {
  const subLine = "This work did not sell in this sale";
  if (input.estimate) {
    return {
      label: "Estimate",
      amount: null,
      amountText: estimateText(input.estimate, input.format),
      subLine,
    };
  }
  return { label: "Not sold", amount: null, amountText: null, subLine };
}

function upcomingHeadline(input: PriceBlockInput): Headline {
  const estimate = input.estimate ? `Estimate ${estimateText(input.estimate, input.format)}` : null;
  if (!isPositive(input.amounts.starting)) {
    return input.estimate
      ? {
          label: "Estimate",
          amount: null,
          amountText: estimateText(input.estimate, input.format),
          subLine: null,
        }
      : { label: "Starting bid", amount: null, amountText: null, subLine: null };
  }
  return headlineWithAmount("Starting bid", input.amounts.starting, estimate, input.format);
}

function headlineOf(input: PriceBlockInput): Headline {
  const copy = lotLifecycleCopy(input.lifecycle);
  const { format } = input;
  const hasBids = input.bidCount > 0;
  const openLabel = lotHeadlineLabel(input.lifecycle, hasBids);
  const openAmount =
    hasBids || !isPositive(input.amounts.starting) ? input.amounts.current : input.amounts.starting;
  switch (input.lifecycle) {
    case "preLaunch":
    case "scheduled":
      return upcomingHeadline(input);
    case "live":
      return headlineWithAmount(openLabel, openAmount, openSubLine(input), format);
    case "extended":
      return headlineWithAmount(openLabel, openAmount, extendedSubLine(input), format);
    case "liveSaleroom":
      return headlineWithAmount(openLabel, openAmount, saleroomSubLine(input), format);
    case "saleroomPaused":
      return headlineWithAmount(
        openLabel,
        openAmount,
        "The auctioneer has paused the sale",
        format,
      );
    case "endedSold":
      return soldHeadline(input);
    case "endedNoSale":
      return unsoldHeadline(input);
    case "cancelled":
    case "withdrawn":
      return {
        label: copy.headlineLabel,
        amount: null,
        amountText: null,
        subLine: NO_PRICE_SUBLINE[input.lifecycle] ?? null,
      };
    default: {
      const unreachable: never = input.lifecycle;
      return unreachable;
    }
  }
}

function registrationLine(input: PriceBlockInput): StateLine | null {
  if (!input.registrationRequired) return null;
  if (input.viewer.registration === "pending") {
    return { text: "Your registration is waiting for approval", tone: "neutral", icon: "dot" };
  }
  if (input.viewer.registration === "declined") {
    return {
      text: "Your registration was declined. Contact client services for help",
      tone: "warning",
      icon: "alert",
    };
  }
  return null;
}

function leadingLine(input: PriceBlockInput): StateLine {
  const max = input.viewer.myMaxBid;
  const text = max
    ? `You're the highest bidder. Your maximum is ${input.format.money(max)}`
    : "You're the highest bidder";
  return { text, tone: "success", icon: "tick" };
}

function outbidLine(input: PriceBlockInput): StateLine {
  const next = input.nextBid;
  return {
    text: next
      ? `You've been outbid. The next bid is ${input.format.money(next)}`
      : "You've been outbid",
    tone: "warning",
    icon: "alert",
  };
}

function maximumSetLine(input: PriceBlockInput): StateLine {
  const max = input.viewer.myMaxBid ?? input.viewer.myHighestBid;
  return {
    text: max
      ? `Your maximum bid is ${input.format.money(max)}. It starts bidding when the lot opens`
      : "Your maximum bid is set. It starts bidding when the lot opens",
    tone: "neutral",
    icon: "tick",
  };
}

function wonLine(input: PriceBlockInput): StateLine {
  const purchase = input.purchase;
  const { format } = input;
  if (purchase?.status === "overdue") {
    return { text: "You won this lot. Payment is overdue", tone: "danger", icon: "alert" };
  }
  if (purchase?.status === "due" || purchase?.status === "not_invoiced") {
    const by = purchase.dueAt && format.date ? ` Pay by ${format.date(purchase.dueAt)}` : "";
    return {
      text: by ? `You won this lot.${by}` : "You won this lot. Payment is due",
      tone: "warning",
      icon: "alert",
    };
  }
  if (purchase?.status === "paid" || purchase?.status === "processing") {
    return { text: "You won this lot and it is paid for", tone: "success", icon: "tick" };
  }
  return { text: "You won this lot", tone: "success", icon: "tick" };
}

type PositionLine = (input: PriceBlockInput) => StateLine | null;

/** One row per position, so a new position is a new row rather than another branch. */
const POSITION_LINES: Record<LotViewerState["position"], PositionLine> = {
  none: () => null,
  leading: leadingLine,
  outbid: outbidLine,
  maximum_set: maximumSetLine,
  won: wonLine,
  lost: () => ({ text: "You didn't win this lot", tone: "neutral", icon: "dot" }),
};

function stateLineOf(input: PriceBlockInput): StateLine | null {
  if (!input.signedIn) return null;
  return POSITION_LINES[input.viewer.position](input) ?? registrationLine(input);
}

function agentLineOf(input: PriceBlockInput): StateLine | null {
  const left = input.agentLimitLeft;
  if (left === null || !lotLifecycleCopy(input.lifecycle).biddingOpen) return null;
  if (!moneyGte(left, "0.01")) {
    return { text: "You are at your limit for this sale", tone: "warning", icon: "alert" };
  }
  return { text: `${input.format.money(left)} left of your limit`, tone: "info", icon: "dot" };
}

const TONE_RANK: Record<LotStatusTone, number> = {
  neutral: 0,
  info: 1,
  success: 2,
  warning: 3,
  danger: 4,
};

function strongestTone(lines: readonly (StateLine | null)[]): LotStatusTone {
  let tone: LotStatusTone = "neutral";
  for (const line of lines) {
    if (line && TONE_RANK[line.tone] > TONE_RANK[tone]) tone = line.tone;
  }
  return tone;
}

/**
 * The price block for every lifecycle and bidder state: the headline figure and its label, the
 * fact line, the viewer's position and an agent's remaining limit. Pure; the caller supplies the
 * money formatter.
 */
export function buildPriceBlock(input: PriceBlockInput): PriceBlockVM {
  const headline = headlineOf(input);
  const stateLine = stateLineOf(input);
  const agentLine = agentLineOf(input);
  return { ...headline, stateLine, agentLine, tone: strongestTone([stateLine, agentLine]) };
}
