import type { IAdminSaleRegistrationsApplicationService } from "../interfaces/admin-routes.js";
import type { ISaleRegistrationAdminService } from "../interfaces/sale-registration-service.js";

export class AdminSaleRegistrationsApplicationService
  implements IAdminSaleRegistrationsApplicationService
{
  constructor(private readonly registrations: ISaleRegistrationAdminService) {}

  listForSaleAdmin(...args: Parameters<ISaleRegistrationAdminService["listForSaleAdmin"]>) {
    return this.registrations.listForSaleAdmin(...args);
  }

  approve(...args: Parameters<ISaleRegistrationAdminService["approve"]>) {
    return this.registrations.approve(...args);
  }

  reject(...args: Parameters<ISaleRegistrationAdminService["reject"]>) {
    return this.registrations.reject(...args);
  }

  updateBidLimit(...args: Parameters<ISaleRegistrationAdminService["updateBidLimit"]>) {
    return this.registrations.updateBidLimit(...args);
  }
}
