import type { IAdminSaleRegistrationsApplicationService } from "../interfaces/admin-routes.js";
import type { SaleRegistrationService } from "../sale-registration.service.js";

export class AdminSaleRegistrationsApplicationService
  implements IAdminSaleRegistrationsApplicationService
{
  constructor(private readonly registrations: SaleRegistrationService) {}

  listForSaleAdmin(...args: Parameters<SaleRegistrationService["listForSaleAdmin"]>) {
    return this.registrations.listForSaleAdmin(...args);
  }

  approve(...args: Parameters<SaleRegistrationService["approve"]>) {
    return this.registrations.approve(...args);
  }

  reject(...args: Parameters<SaleRegistrationService["reject"]>) {
    return this.registrations.reject(...args);
  }

  updateBidLimit(...args: Parameters<SaleRegistrationService["updateBidLimit"]>) {
    return this.registrations.updateBidLimit(...args);
  }
}
