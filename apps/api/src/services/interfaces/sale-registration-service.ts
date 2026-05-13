import type { Result } from "neverthrow";
import type {
  SaleRegistrationAdminRow,
  SaleRegistrationRow,
  SaleRegistrationServiceError,
} from "../sale-registration.service.js";

export interface ISaleRegistrationService {
  listMineForSale(input: { userId: string; saleId: string }): Promise<SaleRegistrationRow[]>;
  requestRegistration(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    bidLimit?: number | undefined;
  }): Promise<Result<SaleRegistrationRow, SaleRegistrationServiceError>>;
  listForSaleAdmin(input: {
    saleId: string;
    status?: "pending" | "approved" | "rejected" | "withdrawn" | undefined;
  }): Promise<SaleRegistrationAdminRow[]>;
  approve(input: {
    saleId: string;
    registrationId: string;
    decidedByUserId: string;
  }): Promise<Result<void, SaleRegistrationServiceError>>;
  reject(input: {
    saleId: string;
    registrationId: string;
    decidedByUserId: string;
    reason?: string | undefined;
  }): Promise<Result<void, SaleRegistrationServiceError>>;
}
