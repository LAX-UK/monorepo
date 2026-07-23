import type { IWatchlistScreeningReader } from "@auction/persistence/interfaces";
import type { AmlService } from "../aml/aml.service.js";
import type { IAdminAmlApplicationService } from "../interfaces/admin-routes.js";
import type { AdminAmlListPage } from "./admin-aml-list-query.service.js";
import { AdminAmlListQueryService } from "./admin-aml-list-query.service.js";

export class AdminAmlApplicationService implements IAdminAmlApplicationService {
  private readonly listQuery: AdminAmlListQueryService;

  constructor(
    private readonly aml: AmlService,
    screeningReader: IWatchlistScreeningReader,
  ) {
    this.listQuery = new AdminAmlListQueryService(screeningReader);
  }

  getPage(...args: Parameters<AdminAmlListQueryService["getPage"]>): Promise<AdminAmlListPage> {
    return this.listQuery.getPage(...args);
  }

  getPendingById(id: string) {
    return this.listQuery.getPendingById(id);
  }

  listForUser(...args: Parameters<AmlService["listForUser"]>) {
    return this.aml.listForUser(...args);
  }

  listPendingReviews(...args: Parameters<AmlService["listPendingReviews"]>) {
    return this.aml.listPendingReviews(...args);
  }

  countPendingReviews(...args: Parameters<AmlService["countPendingReviews"]>) {
    return this.aml.countPendingReviews(...args);
  }

  triage(...args: Parameters<AmlService["triage"]>) {
    return this.aml.triage(...args);
  }

  decide(...args: Parameters<AmlService["decide"]>) {
    return this.aml.decide(...args);
  }
}
