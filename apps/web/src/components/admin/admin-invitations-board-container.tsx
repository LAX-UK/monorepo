"use client";

import { AdminInvitationsBoard } from "@/components/admin/admin-invitations-board";
import { useAdminInvitationsPageQuery } from "@/hooks/admin/use-admin-invitations-page-query";
import type { AdminInvitationsPageParams } from "@/lib/data/http/invitations.shared";

type Props = {
  params: AdminInvitationsPageParams;
  externalMobileCards?: boolean;
};

/** Client container: reads hydrated TanStack Query cache for the invitations table. */
export function AdminInvitationsBoardContainer({ params, externalMobileCards = false }: Props) {
  const { data } = useAdminInvitationsPageQuery(params);

  if (!data) return null;

  return <AdminInvitationsBoard rows={data.rows} externalMobileCards={externalMobileCards} />;
}
