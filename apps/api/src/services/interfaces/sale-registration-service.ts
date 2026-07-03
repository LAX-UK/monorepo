import type { LegalEntityMemberRole } from "@auction/types";
import type { Result } from "neverthrow";

export type SaleRegistrationRow = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  bidLimit: string | null;
  paddleNumber: number | null;
  checkedInAt: Date | null;
  laxNotes: string | null;
  rejectionReason: string | null;
};

export type SaleRegistrationAdminRow = SaleRegistrationRow & {
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
  /** Current membership role for (buyerLegalEntityId, userId); null if no active row. */
  memberRole: LegalEntityMemberRole | null;
  kycStatus: string | null;
};

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
