import type { IAdminListController } from "@/lib/admin/i-admin-list-controller";
import {
  type InvitationsListQuery,
  parseInvitationsListQuery,
} from "@/lib/admin/invitations-list-query";
import {
  type AdminInvitationSummary,
  getAdminInvitationsPage,
} from "@/lib/data/http/invitations.server";

export type { InvitationsListQuery } from "@/lib/admin/invitations-list-query";

export const invitationsListController: IAdminListController<
  AdminInvitationSummary,
  InvitationsListQuery
> = {
  id: "invitations",
  parseQuery(sp) {
    return parseInvitationsListQuery(sp);
  },
  async fetch(q) {
    const { rows, total } = await getAdminInvitationsPage({
      offset: q.offset,
      limit: q.limit,
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { q: q.q } : {}),
    });
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};
