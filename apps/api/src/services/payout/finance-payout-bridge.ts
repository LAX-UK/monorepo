import type { Database } from "@auction/db";
import type {
  IDomainEventSinkPort,
  PayoutAdjustmentService,
  PayoutSettlementDeps,
} from "@auction/finance-runtime";
import type { DomainEventConnection, DomainEventInput } from "@auction/persistence/lib";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import { type PayoutServiceDeps, payoutRepoForTx } from "./payout-helpers.js";

export function apiDomainEventSinkPort(
  sink: IDomainEventSink | undefined,
): IDomainEventSinkPort | null {
  if (!sink) return null;
  return {
    withTx(tx: unknown) {
      const scoped = sink.withTx(tx as DomainEventConnection);
      return {
        publish: (event) => {
          const payload: DomainEventInput = {
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: event.payload,
            actorUserId: event.actorUserId,
            actingLegalEntityId: event.actingLegalEntityId,
          };
          if (event.producer !== undefined) {
            payload.producer = event.producer;
          }
          return scoped.publish(payload);
        },
      };
    },
  };
}

export function toPayoutSettlementDeps(deps: PayoutServiceDeps): PayoutSettlementDeps {
  const adjustments = deps.payoutAdjustments as PayoutAdjustmentService | undefined;
  return {
    repo: deps.repo,
    transactionRunner: deps.transactionRunner,
    domainEventSink: apiDomainEventSinkPort(deps.domainEventSink),
    payoutAdjustments: adjustments,
    payoutRepoForTx: (tx: Database) => payoutRepoForTx(deps.repo, tx),
  };
}

export function bridgePayoutAdjustmentService(
  svc: PayoutAdjustmentService,
): IPayoutAdjustmentService {
  return {
    addPaymentLineToOpenPayoutOrCreateClawback: (input) =>
      svc.addPaymentLineToOpenPayoutOrCreateClawbackFull(input),
    recalculateTotalsFromLines: (repo, payoutId) => svc.recalculateTotalsFromLines(repo, payoutId),
  };
}
