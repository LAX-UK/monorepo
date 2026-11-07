import type { IPaymentGroupRepository } from "@auction/persistence/interfaces";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IPaymentGroupGateway } from "./payment-group-ports.js";
import type { PaymentGroupSettlementService } from "./payment-group-settlement.service.js";

/**
 * - `clear`: no payment for these invoices is under way (any abandoned checkout was ended);
 * - `in_progress`: the payer finished a checkout or money is on its way, so the invoices must not
 *   be offered again;
 * - `unavailable`: the provider could not be asked, so nothing is ended and nothing is started.
 */
export type OpenCheckoutsOutcome = "clear" | "in_progress" | "unavailable";

export type OpenGroupCheckoutsDeps = {
  groups: Pick<IPaymentGroupRepository, "findLiveByPaymentIds">;
  gateway: Pick<IPaymentGroupGateway, "expireCheckout" | "checkoutStatus">;
  settlement: Pick<PaymentGroupSettlementService, "release">;
  now?: () => Date;
};

/**
 * How long a group may be without a checkout before it is taken as one whose start failed. Until
 * then another payment is still being opened for it, and ending it would leave a checkout that
 * is paid against a group that has been let go. The same time protects a checkout another
 * member opened a moment ago.
 */
export const START_GRACE_MS = 2 * 60_000;

/**
 * Ends the checkouts the payer walked away from, so the invoices can be paid again by the method
 * they now choose. A checkout is ended only after the provider confirms it can no longer be paid:
 * it is expired first, then read back, and one that turns out to be finished (a card submitted,
 * a transfer chosen) is left alone and reported as in progress. Money on its way is never ended.
 * Every doubt leaves the invoices held rather than free, and a payment that is still being
 * opened (no checkout recorded yet) is left to finish.
 */
export class OpenGroupCheckouts {
  constructor(private readonly deps: OpenGroupCheckoutsDeps) {}

  async endFor(paymentIds: readonly string[], payerUserId: string): Promise<OpenCheckoutsOutcome> {
    const groups = await this.deps.groups.findLiveByPaymentIds(paymentIds);
    let outcome: OpenCheckoutsOutcome = "clear";
    for (const group of groups) {
      const ended = await this.endOne(group, payerUserId);
      if (ended === "in_progress") return "in_progress";
      if (ended === "unavailable") outcome = "unavailable";
    }
    return outcome;
  }

  private async endOne(
    group: Awaited<ReturnType<IPaymentGroupRepository["findLiveByPaymentIds"]>>[number],
    payerUserId: string,
  ): Promise<OpenCheckoutsOutcome> {
    if (group.status !== "open") return "in_progress";
    const sessionId = group.stripeCheckoutSessionId;
    const age = (this.deps.now?.() ?? new Date()).getTime() - group.createdAt.getTime();
    // Still being opened, or another member's recent checkout: not ours to end.
    if (age < START_GRACE_MS && (!sessionId || group.createdByUserId !== payerUserId)) {
      return "in_progress";
    }
    if (sessionId) {
      try {
        await this.deps.gateway.expireCheckout(sessionId);
        const status = await this.deps.gateway.checkoutStatus(sessionId);
        if (status === "complete") return "in_progress";
        // Expiring answered but the provider still shows it open: it could yet be paid.
        if (status === "open") return "in_progress";
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "open_group_checkout_end_failed",
            paymentGroupId: group.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return "unavailable";
      }
    }
    const released = await this.deps.settlement.release({
      eventId: null,
      groupId: group.id,
      reason: "checkout_abandoned",
    });
    // A group that was settled or released meanwhile is not ours to hand back.
    if (released.action === "skipped") return "in_progress";
    recordMoneyPathEvent("payment_group_abandoned_checkout_ended");
    return "clear";
  }
}
