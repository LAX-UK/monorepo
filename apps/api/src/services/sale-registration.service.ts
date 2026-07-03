import type { ISaleRegistrationRepository } from "../repositories/interfaces/sale-registration.repository.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ISaleRepository } from "./interfaces/repositories.js";
import type { ISaleRegistrationService } from "./interfaces/sale-registration-service.js";
import { SaleRegistrationAdminService } from "./sale-registration/sale-registration-admin.service.js";
import { SaleRegistrationBuyerService } from "./sale-registration/sale-registration-buyer.service.js";
import { createSaleRegistrationContext } from "./sale-registration/sale-registration-context.js";

export type {
  SaleRegistrationAdminRow,
  SaleRegistrationRow,
  SaleRegistrationServiceError,
} from "./interfaces/sale-registration-service.js";

export class SaleRegistrationService implements ISaleRegistrationService {
  private readonly buyer: SaleRegistrationBuyerService;
  private readonly admin: SaleRegistrationAdminService;

  constructor(
    legalEntityRepository: ILegalEntityRepository,
    saleRepo: ISaleRepository,
    registrationRepo: ISaleRegistrationRepository,
  ) {
    const ctx = createSaleRegistrationContext({
      registrationRepo,
      saleRepo,
      legalEntityRepository,
    });
    this.buyer = new SaleRegistrationBuyerService(ctx);
    this.admin = new SaleRegistrationAdminService(ctx);
  }

  listMineForSale(...args: Parameters<SaleRegistrationBuyerService["listMineForSale"]>) {
    return this.buyer.listMineForSale(...args);
  }

  requestRegistration(...args: Parameters<SaleRegistrationBuyerService["requestRegistration"]>) {
    return this.buyer.requestRegistration(...args);
  }

  listForSaleAdmin(...args: Parameters<SaleRegistrationAdminService["listForSaleAdmin"]>) {
    return this.admin.listForSaleAdmin(...args);
  }

  approve(...args: Parameters<SaleRegistrationAdminService["approve"]>) {
    return this.admin.approve(...args);
  }

  reject(...args: Parameters<SaleRegistrationAdminService["reject"]>) {
    return this.admin.reject(...args);
  }

  updateBidLimit(...args: Parameters<SaleRegistrationAdminService["updateBidLimit"]>) {
    return this.admin.updateBidLimit(...args);
  }
}
