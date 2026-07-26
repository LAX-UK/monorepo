"use client";

import { AdminInvitationsBoard } from "@/components/admin/admin-invitations-board";
import { useAdminInvitationsPageQuery } from "@/hooks/admin/use-admin-invitations-page-query";
import { buildInvitationsDrawerHref } from "@/lib/admin/people/invitations-list-href";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.shared";
import type { AdminInvitationsPageParams } from "@/lib/data/http/invitations.shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

type Props = {
  params: AdminInvitationsPageParams;
  externalMobileCards?: boolean;
  selectedInvitationId?: string | undefined;
  selectedInvitation?: AdminInvitationSummary | null;
};

/** Client container: reads hydrated TanStack Query cache for the invitations table. */
export function AdminInvitationsBoardContainer({
  params,
  externalMobileCards = false,
  selectedInvitationId,
  selectedInvitation: selectedFromLoader = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data } = useAdminInvitationsPageQuery(params);

  const selectedFromRows = useMemo(
    () =>
      selectedInvitationId
        ? (data?.rows.find((row) => row.id === selectedInvitationId) ?? null)
        : null,
    [data?.rows, selectedInvitationId],
  );
  const selected = selectedFromRows ?? selectedFromLoader;
  const rows = data?.rows ?? [];

  const onOpen = useCallback(
    (invitation: AdminInvitationSummary) => {
      router.push(buildInvitationsDrawerHref(searchParams, invitation.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildInvitationsDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  if (!data && !selectedFromLoader) return null;

  return (
    <AdminInvitationsBoard
      rows={rows}
      externalMobileCards={externalMobileCards}
      selected={selected}
      onOpen={onOpen}
      onCloseDrawer={onCloseDrawer}
    />
  );
}
