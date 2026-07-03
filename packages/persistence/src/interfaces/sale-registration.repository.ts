import type { LegalEntityMemberRole } from "@auction/types";

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
