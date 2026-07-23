import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { SourceOfFundsCase } from "../services/source-of-funds/source-of-funds.types.js";

export type {
  AdminOnboardingLegalEntityRow,
  AdminOnboardingArtistRow,
  AdminOnboardingKycSessionRow,
  AdminOnboardingDocumentRow,
  AdminOnboardingStaleLeadRow,
  AdminOnboardingIssues,
  AdminManualReviewPaymentRow,
  AdminReviewTaskRow,
  AdminArtistListLinkedFilter,
  AdminArtistListOptions,
  AdminArtistListSort,
} from "@auction/persistence/interfaces";

export type AdminCatalogCreateArtistBody = z.infer<typeof adminCreateArtistBodySchema>;
export type AdminCatalogUpdateArtistBody = z.infer<typeof adminUpdateArtistBodySchema>;

/** Settlement line item for admin SoF detail (payment or won-unpaid estimate). */
export type AdminSourceOfFundsSettlementItemDto = {
  kind: "payment" | "won_unpaid";
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  saleId: string;
  saleTitle: string;
  amountPence: number;
  paymentId?: string;
  paymentStatus?: string;
};

/** Enriched row for `GET /admin/compliance/source-of-funds`. */
export type AdminSourceOfFundsListRowDto = SourceOfFundsCase & {
  buyerEmail: string | null;
  buyerName: string | null;
  buyerLabel: string | null;
  settlementSummary: string | null;
  settlementItemCount: number;
  pendingCasesForBuyer: number;
  submittedDocumentCount: number;
};

export type AdminSourceOfFundsStaffActorDto = {
  id: string;
  label: string | null;
};

export type AdminSourceOfFundsBuyerDto = {
  id: string;
  email: string | null;
  name: string | null;
  label: string | null;
};

/** Full read model for `GET /admin/compliance/source-of-funds/:id/detail`. */
export type AdminSourceOfFundsDetailDto = {
  case: SourceOfFundsCase;
  buyer: AdminSourceOfFundsBuyerDto;
  triagedBy: AdminSourceOfFundsStaffActorDto | null;
  reviewedBy: AdminSourceOfFundsStaffActorDto | null;
  exposureAtOpenPence: number;
  currentActiveExposurePence: number;
  settlementItems: AdminSourceOfFundsSettlementItemDto[];
  blockedPayments: Array<{
    paymentId: string;
    lotId: string;
    lotTitle: string;
    lotNumber: number | null;
    manualReviewReason: "source_of_funds_required";
  }>;
  evidenceDownloads: Array<{
    key: string;
    fileName: string;
    downloadUrl: string | null;
    error?: string;
  }>;
  documentRequest: {
    requestedAt: string | null;
    requestedByUserId: string | null;
    note: string | null;
    requestedDocumentTypes: string[];
    submittedAt: string | null;
  };
  submittedDocuments: Array<{
    id: string;
    requestedType: string;
    label: string | null;
    fileName: string | null;
    reviewStatus: string;
    uploadedAt: string;
    uploadedByUserId: string;
    downloadUrl: string | null;
    staffReview: {
      checks: {
        matchesDeclaredSource?: boolean;
        coversExposure?: boolean;
        recentEnough?: boolean;
        legibleComplete?: boolean;
      };
      note: string | null;
      reviewedAt: string;
      reviewedBy: AdminSourceOfFundsStaffActorDto;
    } | null;
  }>;
};
