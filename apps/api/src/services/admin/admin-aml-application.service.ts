import type { AmlService } from "../aml/aml.service.js";
import type { IAdminAmlApplicationService } from "../interfaces/admin-routes.js";

export class AdminAmlApplicationService implements IAdminAmlApplicationService {
  constructor(private readonly aml: AmlService) {}

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
