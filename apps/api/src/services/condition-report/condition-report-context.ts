import type { Database } from "@auction/db";
import type { IConditionReportRequestRepository } from "../../repositories/interfaces/condition-report-request.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ILotRepository } from "../interfaces/repositories.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { NotificationFactory } from "../notification.factory.js";

export type ConditionReportContext = {
  db: Database;
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventPublisher: DomainEventPublisher | null;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
};

export function createConditionReportContext(input: {
  db: Database;
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventPublisher: DomainEventPublisher | null;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
}): ConditionReportContext {
  return { ...input };
}
