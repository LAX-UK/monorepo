import type {
  ILegalEntityConnectReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../../lib/stripe-processed-event.js";
import type { IDomainEventSink } from "../../domain-event-sink.js";
import type { IPayoutBankChangeNotifier } from "../../organisation-team/organisation-team.notifier.js";

/** Stripe events that add or change a connected account's payout bank account. */
export const BANK_CHANGE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "account.external_account.created",
  "account.external_account.updated",
]);

/**
 * When a connected account's default payout bank account is added or changed, records it in the
 * organisation's Activity and tells its owners, admins and finance. Bank changes are a common
 * fraud route, so the notice is required: a member cannot mute it. Each Stripe event is handled
 * once.
 */
export class ConnectBankChangeHandler {
  constructor(
    private readonly deps: {
      transactionRunner: ITransactionRunner;
      accounts: Pick<ILegalEntityConnectReader, "findLegalEntityRowByStripeAccountId">;
      events: IDomainEventSink;
      notifier: IPayoutBankChangeNotifier;
    },
  ) {}

  async handle(event: Stripe.Event): Promise<{ processed: boolean }> {
    const accountId = typeof event.account === "string" ? event.account : null;
    const external = event.data.object as Stripe.BankAccount | Stripe.Card;
    // Only a bank account that payouts go to is a change worth telling anyone about.
    if (!accountId || external.object !== "bank_account" || !external.default_for_currency) {
      return { processed: false };
    }
    const entity = await this.deps.accounts.findLegalEntityRowByStripeAccountId(accountId);
    if (!entity) return { processed: false };

    const bankLast4 = external.last4 ?? null;
    const claimed = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(tx, event.id, "stripe_connect");
      if (!claimed) return false;
      await this.deps.events.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: entity.id,
        eventType: "legal_entity.payout_bank_changed",
        payload: { bank_last4: bankLast4, bank_name: external.bank_name ?? null },
        actorUserId: null,
        actingLegalEntityId: entity.id,
        schemaVersion: 1,
        producer: "apps/api",
      });
      return true;
    });
    if (claimed) {
      await this.deps.notifier
        .bankChanged({
          legalEntityId: entity.id,
          organisationName: entity.displayName,
          bankLast4,
        })
        .catch(() => undefined);
    }
    return { processed: true };
  }
}
