import { fetchAdminDisputesPage } from "@/lib/data/http/disputes.client";
import type { AdminDisputesPageParams } from "@/lib/data/http/disputes.shared";
import { queryOptions } from "@tanstack/react-query";

export const adminDisputesKeys = {
  all: ["admin-disputes"] as const,
  lists: () => [...adminDisputesKeys.all, "list"] as const,
  list: (params: AdminDisputesPageParams) => [...adminDisputesKeys.lists(), params] as const,
};

export function adminDisputesPageQueryOptions(params: AdminDisputesPageParams) {
  return queryOptions({
    queryKey: adminDisputesKeys.list(params),
    queryFn: () => fetchAdminDisputesPage(params),
  });
}
