"use client";

import { ComplianceAmlBoard } from "@/components/admin/compliance-aml-board/index";
import { buildAmlDrawerHref } from "@/lib/admin/compliance/aml-list-href";
import type { AdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type AmlBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminAmlTableRow[];
  selected?: AdminAmlTableRow | null;
  selectedScreeningId?: string | undefined;
  pagination?: AmlBoardPagination | null | undefined;
  capabilities: {
    canTriage: boolean;
    canDecide: boolean;
    currentUserId: string;
  };
};

export function ComplianceAmlBoardContainer({
  rows,
  selected: selectedProp,
  selectedScreeningId,
  pagination,
  capabilities,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromRows = useMemo(
    () =>
      selectedScreeningId ? (rows.find((row) => row.id === selectedScreeningId) ?? null) : null,
    [rows, selectedScreeningId],
  );
  const selected = selectedProp ?? selectedFromRows;

  const onOpen = useCallback(
    (row: AdminAmlTableRow) => {
      router.push(buildAmlDrawerHref(searchParams, row.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildAmlDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <ComplianceAmlBoard
      rows={rows}
      selected={selected}
      onOpen={onOpen}
      onCloseDrawer={onCloseDrawer}
      pagination={pagination}
      capabilities={capabilities}
    />
  );
}
