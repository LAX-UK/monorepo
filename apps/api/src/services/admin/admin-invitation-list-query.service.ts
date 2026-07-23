import type {
  IUserInvitationRepository,
  InvitationAdminListFilters,
  InvitationAdminListRow,
} from "@auction/persistence/interfaces";

export type AdminInvitationListSummary = {
  total: number;
  pending: number;
  accepted: number;
};

export type AdminInvitationListPage = {
  rows: InvitationAdminListRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminInvitationListSummary;
};

/** Paginated admin invitations list read model (no mutation logic). */
export class AdminInvitationListQueryService {
  constructor(private readonly invites: IUserInvitationRepository) {}

  async getPage(
    filters: InvitationAdminListFilters,
    page: { limit: number; offset: number },
  ): Promise<AdminInvitationListPage> {
    const [rows, counts] = await Promise.all([
      this.invites.listAdmin(filters, page),
      this.invites.counts(filters),
    ]);
    return {
      rows,
      total: counts.total,
      offset: page.offset,
      limit: page.limit,
      summary: {
        total: counts.total,
        pending: counts.pending,
        accepted: counts.accepted,
      },
    };
  }
}
