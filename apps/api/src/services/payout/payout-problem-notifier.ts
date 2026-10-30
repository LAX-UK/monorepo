import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";
import type { Payout } from "@auction/types";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

/** Tells an account that a payout failed or was reversed. */
export interface IPayoutProblemNotifier {
  payoutProblem(
    payout: Pick<Payout, "id" | "legalEntityId" | "status" | "netAmount" | "currency">,
  ): Promise<void>;
}

/**
 * Notifies the members who read the account's payouts (owners, admins, finance). Best effort: a
 * notice that cannot be sent never undoes the payout change. One key per payout and status, so a
 * replayed Stripe event sends nothing twice.
 */
export class PayoutProblemNotifier implements IPayoutProblemNotifier {
  constructor(
    private readonly recipients: ILegalEntityNotificationRecipientReader,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly factory: Pick<INotificationFactory, "createPayoutProblem">,
  ) {}

  async payoutProblem(
    payout: Pick<Payout, "id" | "legalEntityId" | "status" | "netAmount" | "currency">,
  ): Promise<void> {
    try {
      const userIds = await this.recipients.listUserIdsForAudience(payout.legalEntityId, "finance");
      for (const userId of userIds) {
        const row = this.factory.createPayoutProblem(userId, {
          payoutId: payout.id,
          amount: payout.netAmount,
          currency: payout.currency,
          legalEntityId: payout.legalEntityId,
        });
        const key = `payout-problem:${payout.id}:${payout.status}:${userId}`;
        const payload = notificationRowToPayload(row);
        await this.dispatcher.dispatch(userId, {
          ...payload,
          meta: { ...payload.meta, outboxIdempotencyKey: key, emailIdempotencyKey: key },
        });
      }
    } catch (err) {
      console.error("[PayoutProblemNotifier] notice failed", { payoutId: payout.id, err });
    }
  }
}
