"use client";

import { AdminClientsBoard } from "@/components/admin/admin-clients-board";
import { AdminListPreviewDegradedAlert } from "@/components/admin/admin-list-preview-degraded-alert";
import { resolveAdminUserForPickerAction } from "@/lib/actions/admin-users-browse";
import { buildClientsDrawerHref } from "@/lib/admin/people/clients-list-href";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  rows: AdminUserRow[];
  totalMatches: number;
  hasActiveFilters: boolean;
  selectedClientId?: string | undefined;
  listReturnTarget?: string | undefined;
  clearPreviewHref?: string | undefined;
  externalMobileCards?: boolean;
};

export function AdminClientsBoardContainer({
  rows,
  totalMatches,
  hasActiveFilters,
  selectedClientId,
  listReturnTarget,
  clearPreviewHref,
  externalMobileCards = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromRows = useMemo(
    () => rows.find((row) => row.id === selectedClientId) ?? null,
    [rows, selectedClientId],
  );
  const [selectedOffPage, setSelectedOffPage] = useState<AdminUserRow | null>(null);
  const [offPageResolved, setOffPageResolved] = useState(false);

  useEffect(() => {
    if (!selectedClientId) {
      setSelectedOffPage(null);
      setOffPageResolved(false);
      return;
    }
    if (selectedFromRows) {
      setSelectedOffPage(null);
      setOffPageResolved(true);
      return;
    }

    let cancelled = false;
    setOffPageResolved(false);
    void resolveAdminUserForPickerAction(selectedClientId).then((result) => {
      if (cancelled) return;
      setSelectedOffPage(result.ok ? (result.data ?? null) : null);
      setOffPageResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClientId, selectedFromRows]);

  const selected = selectedFromRows ?? selectedOffPage;
  const previewDegraded = Boolean(selectedClientId && offPageResolved && !selected);

  const onOpen = useCallback(
    (user: AdminUserRow) => {
      router.push(buildClientsDrawerHref(searchParams, user.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildClientsDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <div className="space-y-4">
      {previewDegraded && clearPreviewHref ? (
        <AdminListPreviewDegradedAlert entityLabel="client" clearHref={clearPreviewHref} />
      ) : null}
      <AdminClientsBoard
        rows={rows}
        totalMatches={totalMatches}
        hasActiveFilters={hasActiveFilters}
        externalMobileCards={externalMobileCards}
        selected={selected}
        listReturnTarget={listReturnTarget}
        onOpen={onOpen}
        onCloseDrawer={onCloseDrawer}
      />
    </div>
  );
}
