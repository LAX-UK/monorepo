import {
  type BasketLineFraming,
  SHOP_API_ERROR_CODES,
  type ShopApiErrorCode,
} from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { EditionFramingFacts } from "./edition-framing.ports.js";
import { FRAMING_CHOICE_MESSAGES, framingChoiceProblem } from "./edition-framing.view.js";

/** The lines an order is about to be built from, as far as framing goes. */
export type FramingOrderLine = {
  artworkId?: string | null | undefined;
  quantity: number;
  framingOptionId?: string | null | undefined;
  framing?: BasketLineFraming | null | undefined;
};

export type FramingOrderProblem = { status: number; code: ShopApiErrorCode; message: string };

const PROBLEMS = {
  disabled: {
    status: 409,
    code: SHOP_API_ERROR_CODES.BASKET_CONFLICT,
    message: "Framing is no longer available. Remove the frame from your basket to continue.",
  },
  unavailable: {
    status: 409,
    code: SHOP_API_ERROR_CODES.BASKET_CONFLICT,
    message:
      "A frame in your basket is no longer offered. Choose another framing or unframed, then check out.",
  },
} as const;

/**
 * Whether the lines an order is built from can be sold with the framing they carry. This runs on
 * the freshly loaded lines, the ones the order is made from and priced on, so a frame paused or
 * withdrawn since the basket was first read is caught here and never charged or ordered.
 *
 * - With framing switched off, no line may carry a frame.
 * - A frame must still be on offer to this edition (its price is then the one on the line).
 * - An edition's own rule must hold: a framed-only edition needs a frame, and a print framed by
 *   the artist takes none. This is checked only while framing is on, since with it off editions
 *   are sold as before.
 */
export function framingOrderProblem(input: {
  lines: readonly FramingOrderLine[];
  framingEnabled: boolean;
  factsByArtwork: ReadonlyMap<string, EditionFramingFacts>;
}): FramingOrderProblem | null {
  const framed = input.lines.some((line) => line.framingOptionId != null);
  if (!input.framingEnabled) return framed ? PROBLEMS.disabled : null;
  for (const line of input.lines) {
    if (line.framingOptionId != null && !line.framing?.available) return PROBLEMS.unavailable;
    if (!line.artworkId) continue;
    const facts = input.factsByArtwork.get(line.artworkId);
    if (!facts) continue;
    const problem = framingChoiceProblem(facts, line.framingOptionId ?? null);
    if (problem) {
      return {
        status: 400,
        code: SHOP_API_ERROR_CODES.VALIDATION,
        message: FRAMING_CHOICE_MESSAGES[problem],
      };
    }
  }
  return null;
}

export function assertFramingOrderable(input: {
  lines: readonly FramingOrderLine[];
  framingEnabled: boolean;
  factsByArtwork: ReadonlyMap<string, EditionFramingFacts>;
}): void {
  const problem = framingOrderProblem(input);
  if (problem) {
    throw new ShopApiError(problem.code, problem.message, problem.status);
  }
}

/** What the framing on the order's lines adds, for the quantity of each: pence including VAT. */
export function framingSubtotalPence(lines: readonly FramingOrderLine[]): number {
  return lines.reduce(
    (sum, line) => (line.framing ? sum + line.framing.pricePence * line.quantity : sum),
    0,
  );
}
