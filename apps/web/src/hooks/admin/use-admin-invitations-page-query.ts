"use client";

import type { AdminInvitationsPageParams } from "@/lib/data/http/invitations.shared";
import {
  adminInvitationsKeys,
  adminInvitationsPageQueryOptions,
} from "@/lib/data/queries/admin-invitations";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** Presentation hook: admin invitations list backed by TanStack Query cache. */
export function useAdminInvitationsPageQuery(params: AdminInvitationsPageParams) {
  return useQuery({
    ...adminInvitationsPageQueryOptions(params),
  });
}

/** Invalidate all admin invitation list queries after a mutation. */
export function useInvalidateAdminInvitations() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: adminInvitationsKeys.lists(),
    });
}
