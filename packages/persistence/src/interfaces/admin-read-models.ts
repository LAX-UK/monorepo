import type { adminReviewTask } from "@auction/db/schema";
import type { LegalEntityStatus } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

export type RedactedDomainEventRow = {
  id: number;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  actorUserId: string | null;
  actingLegalEntityId: string | null;
  occurredAt: Date;
};

export type FinanceIssueSnapshot = {
  failedPayoutCount: number;
  legalEntitiesWithStripeConnectRequirementsCount: number;
  staleBlockedScheduledPayoutCount: number;
  entitiesPendingReviewCount: number;
  artistsPendingApprovalCount: number;
  staleKycSessionsCount: number;
  documentsAwaitingReviewCount: number;
  staleLeadOrganisationsCount: number;
};

export type StripeConnectRequirementEntityRow = {
  id: string;
  displayName: string;
  status: string;
  stripeConnectRequirementsCurrentlyDue: string[];
};

/** Rows for `/admin/onboarding-issues` — mirrors onboarding issues reader selects. */
export type AdminOnboardingLegalEntityRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
};

export type AdminOnboardingArtistRow = {
  id: string;
  displayName: string;
  status: string;
};

export type AdminOnboardingKycSessionRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  provider: string;
  status: string;
  createdAt: Date;
};

export type AdminOnboardingDocumentRow = {
  id: string;
  legalEntityId: string;
  entityDisplayName: string;
  uploadObjectId: string;
  uploadedAt: Date;
};

export type AdminOnboardingStaleLeadRow = {
  id: string;
  displayName: string;
  createdAt: Date;
};

export type AdminOnboardingIssues = {
  entitiesPendingReview: AdminOnboardingLegalEntityRow[];
  artistsPendingApproval: AdminOnboardingArtistRow[];
  staleKycSessions: AdminOnboardingKycSessionRow[];
  documentsAwaitingReview: AdminOnboardingDocumentRow[];
  staleLeadOrganisations: AdminOnboardingStaleLeadRow[];
};

/** Base row before domain-event enrichment for `/admin/payments/manual-review`. */
export type ManualReviewPaymentBaseRow = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  winnerUserId: string;
  winnerEmail: string;
  sellerLegalEntityId: string;
  sellerDisplayName: string;
  sellerStatus: string;
  sellerArchivedAt: Date | null;
  amount: string;
  createdAt: Date;
};

/** `/admin/payments/manual-review` row shape (after enrichment). */
export type AdminManualReviewPaymentRow = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  winnerUserId: string;
  winnerEmail: string;
  sellerLegalEntityId: string;
  sellerDisplayName: string;
  sellerStatus: string;
  sellerArchivedAt: Date | null;
  amount: string;
  currency: "GBP";
  archiveReason: string | null;
  archiveTimestamp: Date | null;
  manualReviewReason:
    | "seller_archived"
    | "high_value"
    | "seller_archived_and_high_value"
    | "aml_hold"
    | "source_of_funds_required"
    | null;
  /** Pending SoF case id when manualReviewReason is source_of_funds_required. */
  sourceOfFundsCaseId: string | null;
  createdAt: Date;
};

export type AdminReviewTaskRow = InferSelectModel<typeof adminReviewTask>;
