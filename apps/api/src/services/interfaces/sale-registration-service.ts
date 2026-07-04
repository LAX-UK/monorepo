import type { SaleRegistrationAdminRow, SaleRegistrationRow } from "@auction/persistence/interfaces";
import type { Result } from "neverthrow";

export type { SaleRegistrationAdminRow, SaleRegistrationRow };

export type SaleRegistrationServiceError = {
  message: string;
  status: number;
  code?: string;
};

export interface ISaleRegistrationBuyerService {
  listMineForSale(input: { userId: string; saleId: string }): Promise<SaleRegistrationRow[]>;
  requestRegistration(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    bidLimit?: number | undefined;
  }): Promise<Result<SaleRegistrationRow, SaleRegistrationServiceError>>;
}

export interface ISaleRegistrationAdminService {
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
  updateBidLimit(input: {
    saleId: string;
    registrationId: string;
    bidLimit: number | null;
    decidedByUserId: string;
  }): Promise<Result<void, SaleRegistrationServiceError>>;
}

export interface ISaleRegistrationService
  extends ISaleRegistrationBuyerService,
    ISaleRegistrationAdminService {}
