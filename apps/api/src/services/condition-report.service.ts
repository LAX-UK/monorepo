import type { IBidIdentityEligibilityGate } from "@auction/bidding-runtime";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IConditionReportRequestRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import { ConditionReportAdminService } from "./condition-report/condition-report-admin.service.js";
import { ConditionReportBuyerService } from "./condition-report/condition-report-buyer.service.js";
import { createConditionReportContext } from "./condition-report/condition-report-context.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IConditionReportService } from "./interfaces/condition-report.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

export class ConditionReportService implements IConditionReportService {
  private readonly buyer: ConditionReportBuyerService;
  private readonly admin: ConditionReportAdminService;

  constructor(
    transactionRunner: ITransactionRunner,
    lotRepo: ILotRepository,
    legalEntityRepository: ILegalEntityRepository | null,
    domainEventSink: IDomainEventSink | null,
    notificationDispatcher: NotificationDispatcher | null,
    notificationFactory: NotificationFactory,
    requestRepo: IConditionReportRequestRepository,
    identityEligibilityGate: IBidIdentityEligibilityGate | null = null,
  ) {
    const ctx = createConditionReportContext({
      transactionRunner,
      requestRepo,
      lotRepo,
      legalEntityRepository,
      domainEventSink,
      notificationDispatcher,
      notificationFactory,
      identityEligibilityGate,
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
