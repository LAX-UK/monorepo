import type { PayPlan } from "@auction/types";
import { formatGbp } from "@auction/ui";
import { z } from "zod";
import { errorCodesOf, lookupErrorCode } from "./pay-codes";
import { PAY_COPY } from "./pay-copy";

/** What starting a payment came to. Only `redirect` moves money, and only after the person confirms there. */
export type PayStartResult =
  | { kind: "redirect"; url: string }
  /** The plan is no longer what was shown: the page must be read again and checked. */
  | { kind: "changed"; message: string }
  /** Refused or failed; `refresh` when the page should be read again to show why. */
  | { kind: "failed"; message: string; refresh: boolean };

/** What a refused payment says, by the API's code; anything else reads as a passing failure. */
const REFUSAL: Readonly<Record<string, { message: string; refresh: boolean }>> = {
  pay_several_payer_on_hold: {
    message: "We're checking a few details before you can pay. We'll email you when it's done.",
    refresh: true,
  },
  pay_several_winner_on_hold: {
    message:
      "We're checking a few details before this can be paid. We'll email you when it's done.",
    refresh: true,
  },
  pay_several_below_minimum: {
    message: "The total is below what one online payment can take. Add another invoice.",
    refresh: false,
  },
  pay_several_over_limit: {
    message: "The total is more than one online payment can take. Pick fewer invoices.",
    refresh: true,
  },
  pay_several_needs_finance_review: {
    message:
      "A total this size is checked by our finance team first. Pick fewer invoices to pay now.",
    refresh: true,
  },
  pay_several_nothing_payable: {
    message: "None of these invoices can be paid now.",
    refresh: true,
  },
  pay_several_mixed_currency: {
    message: "These invoices are in different currencies. Pay each currency on its own.",
    refresh: false,
  },
  pay_several_conflict: {
    message: "One of these invoices changed while you were looking. Check it and pay again.",
    refresh: true,
  },
  pay_several_unavailable: {
    message: "Paying is paused for a moment. Nothing was charged. Try again shortly.",
    refresh: false,
  },
  onboarding_required: {
    message: "Finish setting up your account before you pay.",
    refresh: true,
  },
  insufficient_entity_role: {
    message: "Your role in this account doesn't pay its invoices.",
    refresh: true,
  },
  account_suspended: {
    message: "Your account is suspended, so it can't make payments. Contact client services.",
    refresh: false,
  },
  bidding_not_allowed_for_role: {
    message: "Staff accounts don't pay for lots.",
    refresh: false,
  },
};

const startedSchema = z.object({ checkoutUrl: z.string().min(1) });

/**
 * The sentence for a plan that changed after it was shown. It names the new total from the plan
 * read again, so what the page now shows and what the notice says are the same figure.
 */
export function planChangedMessage(shownTotalPence: number, now: PayPlan | null): string {
  if (!now) return PAY_COPY.planChangedUnread;
  if (now.totals.pence !== shownTotalPence) {
    return PAY_COPY.planChanged(formatGbp(now.totals.pence));
  }
  return PAY_COPY.planChangedLots;
}

/** Turns the API's answer to "pay these lots" into what the page does next. */
export function payStartResult(
  response: { status: number; body: unknown },
  shownTotalPence: number,
  planNow: () => Promise<PayPlan | null>,
): Promise<PayStartResult> {
  return (async () => {
    if (response.status >= 200 && response.status < 300) {
      const data =
        response.body && typeof response.body === "object" && "data" in response.body
          ? (response.body as { data: unknown }).data
          : null;
      const started = startedSchema.safeParse(data);
      return started.success
        ? { kind: "redirect", url: started.data.checkoutUrl }
        : { kind: "failed", message: PAY_COPY.startFailed, refresh: false };
    }
    if (errorCodesOf(response.body).includes("pay_plan_changed")) {
      return { kind: "changed", message: planChangedMessage(shownTotalPence, await planNow()) };
    }
    const refusal = lookupErrorCode(response.body, REFUSAL);
    return refusal
      ? { kind: "failed", message: refusal.message, refresh: refusal.refresh }
      : { kind: "failed", message: PAY_COPY.startFailed, refresh: false };
  })();
}
