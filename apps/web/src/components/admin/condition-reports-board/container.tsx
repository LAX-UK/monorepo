"use client";

import { AdminConditionReportsBoard } from "@/components/admin/condition-reports-board/index";
import { buildConditionReportsDrawerHref } from "@/lib/admin/condition-reports-list-href";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin-condition-reports.shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type ConditionReportsBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminConditionReportRequestRow[];
  selectedRequestId?: string | undefined;
  pagination?: ConditionReportsBoardPagination | null | undefined;
};

export function AdminConditionReportsBoardContainer({
  rows,
  selectedRequestId,
  pagination,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedRequestId) ?? null,
    [rows, selectedRequestId],
  );

  const onOpen = useCallback(
    (row: AdminConditionReportRequestRow) => {
      router.push(buildConditionReportsDrawerHref(searchParams, row.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildConditionReportsDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <AdminConditionReportsBoard
      rows={rows}
      selected={selected}
      onOpen={onOpen}
      onCloseDrawer={onCloseDrawer}
      pagination={pagination ?? null}
    />
  );
}
