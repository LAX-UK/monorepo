"use client";

import type { AdminDisputesPageParams } from "@/lib/data/http/disputes.shared";
import { adminDisputesPageQueryOptions } from "@/lib/data/queries/admin-disputes";
import { useQuery } from "@tanstack/react-query";

/** Presentation hook: admin disputes list backed by TanStack Query cache. */
export function useAdminDisputesPageQuery(params: AdminDisputesPageParams) {
  return useQuery({
    ...adminDisputesPageQueryOptions(params),
  });
}
