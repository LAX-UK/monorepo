import {
  type LotBadgeCopy,
  type LotEstimate,
  type LotLifecycleKind,
  type PriceBlockInput,
  type PriceBlockVM,
  type ResolvedLotAction,
  buildPriceBlock,
  lotLifecycleCopy,
  resolveLotAction,
} from "@auction/domain";
import { LOT_ACTION_SURFACE, type LotActionSurface } from "./lot-action-surface";
import { formatLotMoney } from "./lot-money";
import { formatLotDay } from "./lot-page-dates";
import { LOT_SECTIONS, type LotSections } from "./lot-page-sections";
import { type LotInfoRow, TIME_ROW_BUILDERS } from "./lot-time-rows";
import type { LotViewerView } from "./lot-viewer";

export type LotPageViewInput = {
  lifecycle: LotLifecycleKind;
  now: Date;
  /** Until the lot opens or closes; `null` when no clock applies. */
  msLeft: number | null;
  startsAt: string | null;
  endsAt: string | null;
  amounts: PriceBlockInput["amounts"];
  estimate: LotEstimate | null;
  bidCount: number;
  reserve: PriceBlockInput["reserve"];
  nextBid: string | null;
  extendedByMs: number | null;
  saleroom: PriceBlockInput["saleroom"];
  signedIn: boolean;
  viewer: LotViewerView;
};

export type LotPageView = {
  lifecycle: LotLifecycleKind;
  badge: LotBadgeCopy;
  /** The lot has no price to show and no sale to take part in. */
  withdrawn: boolean;
  price: PriceBlockVM;
  /** Facts beside the headline: the estimate, then the time. */
  rows: LotInfoRow[];
  action: ResolvedLotAction;
  actionSurface: LotActionSurface;
  sections: LotSections;
};

type BadgeLabel = (input: LotPageViewInput) => string | null;

/** Badge words that depend on the lot's own times; the rest come from the lifecycle table. */
const BADGE_LABEL: Partial<Record<LotLifecycleKind, BadgeLabel>> = {
  scheduled: ({ startsAt, now }) => (startsAt ? `Opens ${formatLotDay(startsAt, now)}` : null),
};

function badgeOf(input: LotPageViewInput): LotBadgeCopy {
  const base = lotLifecycleCopy(input.lifecycle).badge;
  const label = BADGE_LABEL[input.lifecycle]?.(input) ?? base.label;
  return { ...base, label };
}

function estimateRow(input: LotPageViewInput, price: PriceBlockVM): LotInfoRow | null {
  const { estimate } = input;
  // A lot with no price to show (withdrawn, cancelled) shows no figures at all.
  if (!estimate || price.label === "Estimate") return null;
  if (lotLifecycleCopy(input.lifecycle).headline === "none") return null;
  const text = `${formatLotMoney(estimate.low)}–${formatLotMoney(estimate.high)}`;
  // The fact line already says it for an upcoming lot.
  if (price.subLine?.includes(text)) return null;
  return { label: "Estimate", value: text, sub: null, tone: "calm", clock: false };
}

function priceInputOf(input: LotPageViewInput): PriceBlockInput {
  const { viewer } = input;
  return {
    lifecycle: input.lifecycle,
    amounts: input.amounts,
    estimate: input.estimate,
    bidCount: input.bidCount,
    reserve: input.reserve,
    nextBid: input.nextBid,
    extendedByMs: input.extendedByMs,
    saleroom: input.saleroom,
    signedIn: input.signedIn,
    registrationRequired: viewer.registrationRequired,
    viewer,
    purchase: viewer.purchase,
    agentLimitLeft: viewer.agentLimitLeft,
    format: {
      money: (amount) => formatLotMoney(amount),
      date: (iso) => formatLotDay(iso, input.now),
    },
  };
}

/**
 * Everything the lot template shows, decided from the domain: the badge, the price block, the
 * facts beside it, the one primary action and which secondary parts apply. Pure, so each
 * lifecycle and bidder state is a test, and the components only draw what this returns.
 */
export function buildLotPageView(input: LotPageViewInput): LotPageView {
  const price = buildPriceBlock(priceInputOf(input));
  const timeRow = TIME_ROW_BUILDERS[input.lifecycle]({
    msLeft: input.msLeft,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    now: input.now,
  });
  const rows = [estimateRow(input, price), timeRow].filter(
    (row): row is LotInfoRow => row !== null,
  );
  const action = resolveLotAction({
    lifecycle: input.lifecycle,
    signedIn: input.signedIn,
    registrationRequired: input.viewer.registrationRequired,
    registration: input.viewer.registration,
  });
  return {
    lifecycle: input.lifecycle,
    badge: badgeOf(input),
    withdrawn: input.lifecycle === "withdrawn" || input.lifecycle === "cancelled",
    price,
    rows,
    action,
    actionSurface: LOT_ACTION_SURFACE[action],
    sections: LOT_SECTIONS[input.lifecycle],
  };
}
