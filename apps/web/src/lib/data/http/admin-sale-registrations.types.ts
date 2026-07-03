import type { Lot, Sale } from "@auction/types";

export type AdminSaleListRow = {
  sale: Sale;
  lots: Lot[];
  deleteEligibility?: SaleDeleteEligibility | null;
};

export type SaleDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  guards: {
    bidCount: number;
    paymentCount: number;
    approvedRegistrationCount: number;
  };
  blockers: string[];
};

export type AdminSaleDetailRow = AdminSaleListRow & {
  sale: AdminSaleListRow["sale"] & {
    coverImagePresentedUrls?: string[];
    dayImagePresentedUrls?: string[];
  };
};

export type AdminSaleRegistrationRow = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  bidLimit: string | null;
  paddleNumber: number | null;
  checkedInAt: string | null;
  kycStatus: string | null;
  laxNotes: string | null;
  rejectionReason: string | null;
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
  /** Active membership role for the bidder on the buying entity (if any). */
  memberRole: string | null;
};

export type AdminCheckInCandidateEntity = {
  id: string;
  displayName: string;
  role: string;
  kind: string;
  existingRegistration: {
    status: string;
    paddleNumber: number | null;
    bidLimit: string | null;
    checkedInAt: string | null;
  } | null;
};

export type AdminCheckInCandidate = {
  userId: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  kycStatus: string;
  suspended: boolean;
  eligibleEntities: AdminCheckInCandidateEntity[];
};
