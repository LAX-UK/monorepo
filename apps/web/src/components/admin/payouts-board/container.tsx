"use client";

import { AdminPayoutsBoard } from "@/components/admin/payouts-board/index";
import { buildPayoutsDrawerHref } from "@/lib/admin/payouts-list-href";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import { toPayoutBoardRows } from "@/lib/data/view-models/admin-payouts-table.vm";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type PayoutsBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminPayoutRow[];
  selectedPayoutId?: string | undefined;
  statusChips?: React.ReactNode;
  pagination?: PayoutsBoardPagination | null | undefined;
  capabilities: {
    canProcess: boolean;
    canReverse: boolean;
  };
};

export function AdminPayoutsBoardContainer({
  rows,
  selectedPayoutId,
  statusChips,
  pagination,
  capabilities,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardRows = useMemo(() => toPayoutBoardRows(rows), [rows]);
  const selected = useMemo(
    () => boardRows.find((row) => row.id === selectedPayoutId) ?? null,
    [boardRows, selectedPayoutId],
  );

  const onOpen = useCallback(
    (row: AdminPayoutBoardRow) => {
      router.push(buildPayoutsDrawerHref(searchParams, row.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildPayoutsDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <AdminPayoutsBoard
      rows={boardRows}
      selected={selected}
      onOpen={onOpen}
      onCloseDrawer={onCloseDrawer}
      statusChips={statusChips}
      pagination={pagination}
      capabilities={capabilities}
    />
  );
}
