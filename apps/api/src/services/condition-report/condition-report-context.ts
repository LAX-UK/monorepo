import type { IConditionReportRequestRepository } from "../../repositories/interfaces/condition-report-request.repository.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ILotRepository } from "../interfaces/repositories.js";
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
