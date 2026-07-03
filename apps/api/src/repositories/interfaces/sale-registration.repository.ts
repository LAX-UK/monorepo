import type {
  SaleRegistrationAdminRow,
  SaleRegistrationRow,
} from "../../services/interfaces/sale-registration-service.js";

export type InsertSaleRegistrationInput = {
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  bidLimit: string | null;
};

export interface ISaleRegistrationRepository {
  listBySaleAndUser(saleId: string, userId: string): Promise<SaleRegistrationRow[]>;
  findBySaleUserEntity(
    saleId: string,
    userId: string,
    buyerLegalEntityId: string,
  ): Promise<SaleRegistrationRow | null>;
  findByIdAndSale(registrationId: string, saleId: string): Promise<SaleRegistrationRow | null>;
  insert(input: InsertSaleRegistrationInput): Promise<SaleRegistrationRow | null>;
  reactivateToPending(id: string, bidLimit: string | null): Promise<SaleRegistrationRow | null>;
  setApproved(registrationId: string, decidedByUserId: string): Promise<void>;
  setRejected(
    registrationId: string,
    decidedByUserId: string,
    reason: string | null,
  ): Promise<void>;
  updateBidLimit(
    registrationId: string,
    bidLimit: string | null,
    decidedByUserId: string,
  ): Promise<void>;
  listForAdmin(input: {
    saleId: string;
    status?: "pending" | "approved" | "rejected" | "withdrawn" | undefined;
  }): Promise<SaleRegistrationAdminRow[]>;
}
