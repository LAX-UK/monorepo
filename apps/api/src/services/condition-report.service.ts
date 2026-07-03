import type { Database } from "@auction/db";
import { DrizzleConditionReportRequestRepository } from "../repositories/drizzle-condition-report-request.repository.js";
import type { IConditionReportRequestRepository } from "../repositories/interfaces/condition-report-request.repository.js";
import { ConditionReportAdminService } from "./condition-report/condition-report-admin.service.js";
import { ConditionReportBuyerService } from "./condition-report/condition-report-buyer.service.js";
import { createConditionReportContext } from "./condition-report/condition-report-context.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IConditionReportService } from "./interfaces/condition-report.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotRepository } from "./interfaces/repositories.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

export class ConditionReportService implements IConditionReportService {
  private readonly buyer: ConditionReportBuyerService;
  private readonly admin: ConditionReportAdminService;

  constructor(
    db: Database,
    lotRepo: ILotRepository,
    legalEntityRepository: ILegalEntityRepository | null,
    domainEventPublisher: DomainEventPublisher | null,
    notificationDispatcher: NotificationDispatcher | null,
    notificationFactory: NotificationFactory,
    requestRepo?: IConditionReportRequestRepository,
  ) {
    const ctx = createConditionReportContext({
      db,
      requestRepo: requestRepo ?? new DrizzleConditionReportRequestRepository(db),
      lotRepo,
      legalEntityRepository,
      domainEventPublisher,
      notificationDispatcher,
      notificationFactory,
    });
    this.buyer = new ConditionReportBuyerService(ctx);
    this.admin = new ConditionReportAdminService(ctx);
  }

  createRequest(...args: Parameters<ConditionReportBuyerService["createRequest"]>) {
    return this.buyer.createRequest(...args);
  }

  findForBuyerOnLot(...args: Parameters<ConditionReportBuyerService["findForBuyerOnLot"]>) {
    return this.buyer.findForBuyerOnLot(...args);
  }

  listForBuyer(...args: Parameters<ConditionReportBuyerService["listForBuyer"]>) {
    return this.buyer.listForBuyer(...args);
  }

  listForAdmin(...args: Parameters<ConditionReportAdminService["listForAdmin"]>) {
    return this.admin.listForAdmin(...args);
  }

  markInProgress(...args: Parameters<ConditionReportAdminService["markInProgress"]>) {
    return this.admin.markInProgress(...args);
  }

  fulfill(...args: Parameters<ConditionReportAdminService["fulfill"]>) {
    return this.admin.fulfill(...args);
  }

  decline(...args: Parameters<ConditionReportAdminService["decline"]>) {
    return this.admin.decline(...args);
  }
}
