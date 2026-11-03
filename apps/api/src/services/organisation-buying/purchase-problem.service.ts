import { accountPurchaseScope, purchaseProblemReference } from "@auction/domain";
import type {
  AccountRecordsScope,
  IAccountPurchaseFactsReader,
  IPurchaseProblemRepository,
  ITransactionRunner,
  PurchaseProblemRecord,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  BuyingResult,
  IPurchaseProblemService,
  PurchaseProblemView,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { buyingError, entityActorOf, purchaseView } from "./purchase-view.js";

export type PurchaseProblemServiceDeps = {
  purchases: IAccountPurchaseFactsReader;
  problems: IPurchaseProblemRepository;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  now: () => Date;
};

function problemView(record: PurchaseProblemRecord): PurchaseProblemView {
  return {
    id: record.id,
    reference: purchaseProblemReference(record.id),
    status: record.status,
    category: record.category,
    reportedAt: record.createdAt,
  };
}

/**
 * A buyer's report of a problem with a paid purchase. It is open to the members who follow the
 * purchase (everyone for the people who see the account's money, their own wins for buyer
 * agents), only once the invoice is paid, and one report stays open per purchase.
 */
export class PurchaseProblemService implements IPurchaseProblemService {
  constructor(private readonly deps: PurchaseProblemServiceDeps) {}

  private scopeOf(actor: OrganisationMemberActor): AccountRecordsScope | null {
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope) return null;
    return {
      legalEntityId: actor.legalEntityId,
      memberUserId: scope === "own" ? actor.userId : null,
    };
  }

  /** The purchase as the member sees it, or the refusal when they do not follow it. */
  private async followed(actor: OrganisationMemberActor, lotId: string) {
    const scope = this.scopeOf(actor);
    if (!scope) return err(buyingError("insufficient_entity_role"));
    const [row] = await this.deps.purchases.list({
      ...scope,
      lotIds: [lotId],
      limit: 1,
      offset: 0,
    });
    if (!row) return err(buyingError("purchase_not_found"));
    return ok(purchaseView(row, actor, this.deps.now()));
  }

  async current(
    actor: OrganisationMemberActor,
    lotId: string,
  ): BuyingResult<PurchaseProblemView | null> {
    const followed = await this.followed(actor, lotId);
    if (followed.isErr()) return err(followed.error);
    const open = await this.deps.problems.findOpen(lotId, actor.legalEntityId);
    return ok(open ? problemView(open) : null);
  }

  async report(
    actor: OrganisationMemberActor,
    lotId: string,
    input: { category: PurchaseProblemView["category"]; message: string },
  ): BuyingResult<{ problem: PurchaseProblemView; created: boolean }> {
    const followed = await this.followed(actor, lotId);
    if (followed.isErr()) return err(followed.error);
    const purchase = followed.value;
    if (purchase.invoice.status !== "paid" || !purchase.invoice.paymentId) {
      return err(buyingError("problem_purchase_not_paid"));
    }
    const paymentId = purchase.invoice.paymentId;

    const { record, created } = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const opened = await this.deps.problems.openInTransaction(tx, {
        lotId,
        buyerLegalEntityId: actor.legalEntityId,
        paymentId,
        category: input.category,
        message: input.message,
        reportedByUserId: actor.userId,
      });
      if (opened.created) {
        await this.deps.events.withTx(tx).publish({
          aggregateType: "purchase_problem",
          aggregateId: opened.record.id,
          eventType: "purchase_problem.reported",
          payload: { lotId, paymentId, category: input.category },
          actorUserId: actor.userId,
          actingLegalEntityId: actor.legalEntityId,
        });
      }
      return opened;
    });
    return ok({ problem: problemView(record), created });
  }
}
