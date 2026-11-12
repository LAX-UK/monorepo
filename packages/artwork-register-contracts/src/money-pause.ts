/**
 * New money stops while Zoho says an artwork is Sold or Reserved and LAX still has it for sale.
 * One guard covers every path that takes money or accepts an offer: lax.art checkout, and the
 * re-offer Send and Accept steps. Live bidding mid-sale is not touched.
 */

import type { RegisterLink } from "./offer-lock.js";

/** What a buyer reads when checkout is refused. Calm, and it does not say why. */
export const MONEY_PAUSED_BUYER_MESSAGE = "This artwork is no longer available to buy online.";

/** What staff reading an API refusal see for the re-offer steps. */
export const MONEY_PAUSED_STAFF_MESSAGE =
  "Zoho says this artwork is Sold or Reserved. New payments and acceptances are paused until staff decide.";

export const MONEY_PAUSE_ACTIONS = ["checkout", "reoffer_send", "reoffer_accept"] as const;
export type MoneyPauseAction = (typeof MONEY_PAUSE_ACTIONS)[number];

/** The one question the guard asks; the register answers it from the open items. */
export interface MoneyPauseReader {
  isPaused(link: RegisterLink): Promise<boolean>;
}

export class ArtworkMoneyPausedError extends Error {
  readonly code = "artwork_money_paused";
  constructor(
    readonly action: MoneyPauseAction,
    message: string,
  ) {
    super(message);
    this.name = "ArtworkMoneyPausedError";
  }
}

/**
 * Throws `ArtworkMoneyPausedError` when new money for this artwork is paused. An artwork with no
 * register link is not governed, as with the offer lock.
 *
 * Wired today: lax.art checkout (create, replay, resume) and the payment-completed processor, which
 * routes a payment taken while paused to finance instead of fulfilling it. NOT wired yet: the
 * re-offer endpoints do not exist (only the domain does). When the re-offer service lands, it MUST
 * call this with "reoffer_send" before it sends an offer to the next bidder and with
 * "reoffer_accept" before it accepts one. This is tracked as follow-up work, and the contract test
 * in `money-pause.reoffer-contract.test.ts` fails if such a service appears without the call.
 */
export async function assertMoneyNotPaused(
  pause: MoneyPauseReader,
  link: RegisterLink | null,
  action: MoneyPauseAction,
): Promise<void> {
  if (!link) return;
  if (!(await pause.isPaused(link))) return;
  throw new ArtworkMoneyPausedError(
    action,
    action === "checkout" ? MONEY_PAUSED_BUYER_MESSAGE : MONEY_PAUSED_STAFF_MESSAGE,
  );
}
