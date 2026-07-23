"use client";

import { AdminListPreviewDegradedAlert } from "@/components/admin/admin-list-preview-degraded-alert";
import { AdminStaffBoard } from "@/components/admin/admin-staff-board";
import { resolveAdminUserForPickerAction } from "@/lib/actions/admin-users-browse";
import { buildStaffDrawerHref } from "@/lib/admin/people/staff-list-href";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  rows: AdminUserRow[];
  totalMatches: number;
  hasActiveFilters: boolean;
  selectedStaffId?: string | undefined;
  listReturnTarget?: string | undefined;
  clearPreviewHref?: string | undefined;
  externalMobileCards?: boolean;
};

export function AdminStaffBoardContainer({
  rows,
  totalMatches,
  hasActiveFilters,
  selectedStaffId,
  listReturnTarget,
  clearPreviewHref,
  externalMobileCards = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromRows = useMemo(
    () => rows.find((row) => row.id === selectedStaffId) ?? null,
    [rows, selectedStaffId],
  );
  const [selectedOffPage, setSelectedOffPage] = useState<AdminUserRow | null>(null);
  const [offPageResolved, setOffPageResolved] = useState(false);

  useEffect(() => {
    if (!selectedStaffId) {
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
    void resolveAdminUserForPickerAction(selectedStaffId).then((result) => {
      if (cancelled) return;
      setSelectedOffPage(result.ok ? (result.data ?? null) : null);
      setOffPageResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedStaffId, selectedFromRows]);

  const selected = selectedFromRows ?? selectedOffPage;
  const previewDegraded = Boolean(selectedStaffId && offPageResolved && !selected);

  const onOpen = useCallback(
    (user: AdminUserRow) => {
      router.push(buildStaffDrawerHref(searchParams, user.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildStaffDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <div className="space-y-4">
      {previewDegraded && clearPreviewHref ? (
        <AdminListPreviewDegradedAlert entityLabel="staff member" clearHref={clearPreviewHref} />
      ) : null}
      <AdminStaffBoard
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
