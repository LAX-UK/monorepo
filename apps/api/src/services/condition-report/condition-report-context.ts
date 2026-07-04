import type { IConditionReportRequestRepository } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { ILotRepository } from "@auction/persistence";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { NotificationFactory } from "../notification.factory.js";

export type ConditionReportContext = {
  transactionRunner: import("@auction/persistence").ITransactionRunner;
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventSink: IDomainEventSink | null;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
};

export function createConditionReportContext(input: {
  transactionRunner: import("@auction/persistence").ITransactionRunner;
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventSink: IDomainEventSink | null;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
}): ConditionReportContext {
  return { ...input };
}
