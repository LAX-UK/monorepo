import type { LotLifecycleKind } from "./lifecycle-copy.js";
import { lotLifecycleCopy } from "./lifecycle-copy.js";
import type { StateLine } from "./price-block.js";
import type { LotPosition } from "./viewer-state.js";

/** A card's own button: only a lot the viewer was outbid on offers one. */
export type CardStateAction = { kind: "bid"; label: string; amount: string };

export type CardStateLine = StateLine & {
  action: CardStateAction | null;
};

export type CardStateInput = {
  position: LotPosition;
  lifecycle: LotLifecycleKind;
  /** The next valid bid, for the outbid card's button. */
  nextBid: string | null;
  format: { money(amount: string): string };
};

type CardRule = (input: CardStateInput) => CardStateLine;

const line = (
  text: string,
  tone: StateLine["tone"],
  icon: StateLine["icon"],
  action: CardStateAction | null = null,
): CardStateLine => ({ text, tone, icon, action });

/**
 * A card says how the viewer stands only on a lot they have bid on; watching is the filled
 * heart and a lot with no bid from the viewer has no line, so the grid stays quiet. One row per
 * position.
 */
const CARD_RULES: Partial<Record<LotPosition, CardRule>> = {
  leading: () => line("You're leading", "success", "tick"),
  outbid: (input) => {
    const open = lotLifecycleCopy(input.lifecycle).biddingOpen;
    const action: CardStateAction | null =
      open && input.nextBid
        ? {
            kind: "bid",
            label: `Bid ${input.format.money(input.nextBid)}`,
            amount: input.nextBid,
          }
        : null;
    return line("You've been outbid", "warning", "alert", action);
  },
  maximum_set: () => line("Maximum bid set", "neutral", "tick"),
  won: () => line("You won this lot", "success", "tick"),
  lost: () => line("You didn't win", "neutral", "dot"),
};

/** The state line for a card, or `null` when the viewer has no bid on the lot. */
export function cardStateLine(input: CardStateInput): CardStateLine | null {
  return CARD_RULES[input.position]?.(input) ?? null;
}
