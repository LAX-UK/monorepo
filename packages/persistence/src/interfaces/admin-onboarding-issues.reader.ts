import type {
  AdminOnboardingArtistRow,
  AdminOnboardingArtistsLensSummary,
  AdminOnboardingDocumentRow,
  AdminOnboardingDocumentsLensSummary,
  AdminOnboardingEntitiesLensSummary,
  AdminOnboardingIssuesCrossSummary,
  AdminOnboardingIssuesListResult,
  AdminOnboardingIssuesTab,
  AdminOnboardingKycLensSummary,
  AdminOnboardingKycSessionRow,
  AdminOnboardingLegalEntityRow,
  AdminOnboardingOrganizationsLensSummary,
  AdminOnboardingStaleLeadRow,
} from "./admin-read-models.js";

export interface IAdminOnboardingIssuesReader {
  summarizeAllQueues(): Promise<AdminOnboardingIssuesCrossSummary>;

  listEntitiesPendingReview(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingLegalEntityRow>>;
  summarizeEntitiesPendingReview(): Promise<AdminOnboardingEntitiesLensSummary>;

  listArtistsPendingApproval(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingArtistRow>>;
  summarizeArtistsPendingApproval(): Promise<AdminOnboardingArtistsLensSummary>;

  listStaleKycSessions(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingKycSessionRow>>;
  summarizeStaleKycSessions(): Promise<AdminOnboardingKycLensSummary>;

  listDocumentsAwaitingReview(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingDocumentRow>>;
  summarizeDocumentsAwaitingReview(): Promise<AdminOnboardingDocumentsLensSummary>;

  listStaleLeadOrganisations(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingStaleLeadRow>>;
  summarizeStaleLeadOrganisations(): Promise<AdminOnboardingOrganizationsLensSummary>;

  findRowById(
    tab: AdminOnboardingIssuesTab,
    id: string,
  ): Promise<
    | AdminOnboardingLegalEntityRow
    | AdminOnboardingArtistRow
    | AdminOnboardingKycSessionRow
    | AdminOnboardingDocumentRow
    | AdminOnboardingStaleLeadRow
    | null
  >;
}

export type {
  AdminOnboardingIssues,
  AdminOnboardingIssuesCrossSummary,
  AdminOnboardingIssuesListResult,
  AdminOnboardingIssuesTab,
  AdminOnboardingIssuesLensSummary,
} from "./admin-read-models.js";
