import type { Database } from "@auction/db";
import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  dealSettlementFollowUpRaisedEvent,
} from "@auction/domain";
import type {
  IDealSettlementFollowUpMarker,
  IPrivateSaleDealQueryReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";

export type DealSettlementFollowUpDeps = {
  queries: Pick<IPrivateSaleDealQueryReader, "listSettlementFollowUps">;
  transactionRunner: ITransactionRunner;
  eventsForTx: (tx: Database) => IDomainEventSink;
  raised: IDealSettlementFollowUpMarker;
};

export type SettlementFollowUpCheckResult = {
  /** Settled deals not yet raised at their current severity, urgent first. */
  open: number;
  /** Deals raised by this run: first time, or newly urgent. */
  raised: number;
  /** Of the open ones, those the register shows somewhere else. */
  urgent: number;
};

const CHECK_LIMIT = 500;

/**
 * The daily check behind the "Settled but not marked sold" item. The item itself is derived on
 * every read, so the lists, the nav count and the staff bell are right without this running. The
 * check recomputes it for every deal and writes one "raised" event per deal, so the audit log says
 * when staff were first told, a missed settlement step is noticed by morning, and the alert goes
 * out once however many times the check runs.
 */
export class DealSettlementFollowUpService {
  constructor(private readonly deps: DealSettlementFollowUpDeps) {}

  async raiseNew(): Promise<SettlementFollowUpCheckResult> {
    // Urgent first and only those not yet raised, so already-raised deals never use up the window.
    const open = await this.deps.queries.listSettlementFollowUps({ kind: "all" }, CHECK_LIMIT, {
      unraisedOnly: true,
    });
    if (open.length === CHECK_LIMIT) {
      recordMoneyPathEvent("private_sale_settlement_follow_up_check_truncated");
      console.error(
        JSON.stringify({
          msg: "private_sale_settlement_follow_up_check_truncated",
          limit: CHECK_LIMIT,
        }),
      );
    }
    let raised = 0;
    for (const row of open) {
      try {
        const first = await this.deps.transactionRunner.runInTransaction(async (tx) => {
          if (!(await this.deps.raised.claimInTransaction(tx, row.dealId, row.severity)))
            return false;
          const event = dealSettlementFollowUpRaisedEvent(
            { id: row.dealId, reference: row.reference },
            row.severity,
          );
          await this.deps.eventsForTx(tx).publish({
            aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
            aggregateId: row.dealId,
            eventType: event.eventType,
            payload: event.payload,
            actorUserId: null,
            actingLegalEntityId: null,
          });
          return true;
        });
        if (!first) continue;
        raised += 1;
        recordMoneyPathEvent(`private_sale_settlement_follow_up_${row.severity}`);
        console.error(
          JSON.stringify({
            msg: "private_sale_settlement_follow_up_raised",
            dealId: row.dealId,
            reference: row.reference,
            severity: row.severity,
          }),
        );
      } catch (error) {
        console.error("[DealSettlementFollowUpService] could not raise", row.dealId, error);
      }
    }
    return {
      open: open.length,
      raised,
      urgent: open.filter((row) => row.severity === "urgent").length,
    };
  }
}
