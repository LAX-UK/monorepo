import type {
  AdminOnboardingArtistRow,
  AdminOnboardingDocumentRow,
  AdminOnboardingIssuesCrossSummary,
  AdminOnboardingIssuesLensSummary,
  AdminOnboardingIssuesTab,
  AdminOnboardingKycSessionRow,
  AdminOnboardingLegalEntityRow,
  AdminOnboardingStaleLeadRow,
  IAdminOnboardingIssuesReader,
} from "@auction/persistence/interfaces";
import type { IAdminOnboardingIssuesQueryService } from "../interfaces/admin-routes.js";

export type AdminOnboardingIssuesPageRow =
  | AdminOnboardingLegalEntityRow
  | AdminOnboardingArtistRow
  | AdminOnboardingKycSessionRow
  | AdminOnboardingDocumentRow
  | AdminOnboardingStaleLeadRow;

export type AdminOnboardingIssuesPage = {
  tab: AdminOnboardingIssuesTab;
  rows: AdminOnboardingIssuesPageRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminOnboardingIssuesCrossSummary;
  lensSummary: AdminOnboardingIssuesLensSummary;
};

export class AdminOnboardingIssuesQueryService implements IAdminOnboardingIssuesQueryService {
  constructor(private readonly reader: IAdminOnboardingIssuesReader) {}

  async getPage(input: {
    tab: AdminOnboardingIssuesTab;
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesPage> {
    const [summary, lens] = await Promise.all([
      this.reader.summarizeAllQueues(),
      this.fetchLens(input.tab, input.limit, input.offset),
    ]);
    return {
      tab: input.tab,
      rows: lens.rows,
      total: lens.total,
      offset: input.offset,
      limit: input.limit,
      summary,
      lensSummary: lens.lensSummary,
    };
  }

  private async fetchLens(
    tab: AdminOnboardingIssuesTab,
    limit: number,
    offset: number,
  ): Promise<{
    rows: AdminOnboardingIssuesPageRow[];
    total: number;
    lensSummary: AdminOnboardingIssuesLensSummary;
  }> {
    switch (tab) {
      case "entities": {
        const [list, lensSummary] = await Promise.all([
          this.reader.listEntitiesPendingReview({ limit, offset }),
          this.reader.summarizeEntitiesPendingReview(),
        ]);
        return { rows: list.rows, total: list.total, lensSummary: { tab, summary: lensSummary } };
      }
      case "artists": {
        const [list, lensSummary] = await Promise.all([
          this.reader.listArtistsPendingApproval({ limit, offset }),
          this.reader.summarizeArtistsPendingApproval(),
        ]);
        return { rows: list.rows, total: list.total, lensSummary: { tab, summary: lensSummary } };
      }
      case "kyc": {
        const [list, lensSummary] = await Promise.all([
          this.reader.listStaleKycSessions({ limit, offset }),
          this.reader.summarizeStaleKycSessions(),
        ]);
        return { rows: list.rows, total: list.total, lensSummary: { tab, summary: lensSummary } };
      }
      case "documents": {
        const [list, lensSummary] = await Promise.all([
          this.reader.listDocumentsAwaitingReview({ limit, offset }),
          this.reader.summarizeDocumentsAwaitingReview(),
        ]);
        return { rows: list.rows, total: list.total, lensSummary: { tab, summary: lensSummary } };
      }
      case "organizations": {
        const [list, lensSummary] = await Promise.all([
          this.reader.listStaleLeadOrganisations({ limit, offset }),
          this.reader.summarizeStaleLeadOrganisations(),
        ]);
        return { rows: list.rows, total: list.total, lensSummary: { tab, summary: lensSummary } };
      }
      default: {
        const _exhaustive: never = tab;
        throw new Error(`Unsupported onboarding tab: ${String(_exhaustive)}`);
      }
    }
  }

  getSelectedItem(input: {
    tab: AdminOnboardingIssuesTab;
    id: string;
  }): Promise<AdminOnboardingIssuesPageRow | null> {
    return this.reader.findRowById(input.tab, input.id);
  }
}
