import { fetchAdminInvitationsPage } from "@/lib/data/http/invitations.client";
import type { AdminInvitationsPageParams } from "@/lib/data/http/invitations.shared";
import { queryOptions } from "@tanstack/react-query";

export const adminInvitationsKeys = {
  all: ["admin-invitations"] as const,
  lists: () => [...adminInvitationsKeys.all, "list"] as const,
  list: (params: AdminInvitationsPageParams) => [...adminInvitationsKeys.lists(), params] as const,
};

export function adminInvitationsPageQueryOptions(params: AdminInvitationsPageParams) {
  return queryOptions({
    queryKey: adminInvitationsKeys.list(params),
    queryFn: () => fetchAdminInvitationsPage(params),
  });
}
