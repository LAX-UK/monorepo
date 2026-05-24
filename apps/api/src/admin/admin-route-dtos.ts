import type { adminReviewTask } from "@auction/db/schema";
import type { ArtistKind, ArtistStatus, LegalEntityStatus } from "@auction/types";
import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import type { InferSelectModel } from "drizzle-orm";
import type { z } from "zod";

/** Rows for `/admin/onboarding-issues` — mirrors `AdminDashboardQueryService.getOnboardingIssues` selects. */
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
  createdAt: Date;
};

export type AdminReviewTaskRow = InferSelectModel<typeof adminReviewTask>;

export type AdminArtistListSort =
  | "name_asc"
  | "name_desc"
  | "updated_desc"
  | "updated_asc"
  | "lots_desc"
  | "lots_asc"
  | "status_asc"
  | "status_desc";

export type AdminArtistListLinkedFilter = "any" | "yes" | "no";

export type AdminArtistListOptions = {
  includeArchived?: boolean;
  archivedOnly?: boolean;
  q?: string;
  kind?: ArtistKind;
  /** When set, restricts to these kinds (e.g. brand+marque). Takes precedence over `kind`. */
  kinds?: ArtistKind[];
  status?: ArtistStatus;
  ownerUserId?: string;
  featured?: boolean;
  verified?: boolean;
  linked?: AdminArtistListLinkedFilter;
  sort?: AdminArtistListSort;
  limit?: number;
  offset?: number;
};

export type AdminCatalogCreateArtistBody = z.infer<typeof adminCreateArtistBodySchema>;
export type AdminCatalogUpdateArtistBody = z.infer<typeof adminUpdateArtistBodySchema>;
