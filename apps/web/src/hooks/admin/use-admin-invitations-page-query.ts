"use client";

import type { AdminInvitationsPageParams } from "@/lib/data/http/invitations.shared";
import { adminInvitationsPageQueryOptions } from "@/lib/data/queries/admin-invitations";
import { useQuery } from "@tanstack/react-query";

/** Presentation hook: admin invitations list backed by TanStack Query cache. */
export function useAdminInvitationsPageQuery(params: AdminInvitationsPageParams) {
  return useQuery({
    ...adminInvitationsPageQueryOptions(params),
  });
}
