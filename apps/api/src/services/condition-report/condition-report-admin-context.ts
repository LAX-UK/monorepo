import type { IConditionReportRequestRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { NotificationFactory } from "../notification.factory.js";

export type ConditionReportAdminContext = {
  transactionRunner: ITransactionRunner;
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventSink: IDomainEventSink | null;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
};

export function createConditionReportAdminContext(input: {
  transactionRunner: ITransactionRunner;
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventSink: IDomainEventSink | null;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
}): ConditionReportAdminContext {
  return input;
}
