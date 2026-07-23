"use client";

import { AdminLotFulfilmentBoard } from "@/components/admin/lot-fulfilment-board/index";
import { buildLotFulfilmentDrawerHref } from "@/lib/admin/lot-fulfilment-list-href";
import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin-lot-fulfilment.shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type LotFulfilmentBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminLotFulfilmentListRow[];
  selectedLotId?: string | undefined;
  returnStatus: string;
  statusChips?: React.ReactNode;
  pagination?: LotFulfilmentBoardPagination | null | undefined;
};

export function AdminLotFulfilmentBoardContainer({
  rows,
  selectedLotId,
  returnStatus,
  statusChips,
  pagination,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = useMemo(
    () => rows.find((row) => row.lotId === selectedLotId) ?? null,
    [rows, selectedLotId],
  );

  const onOpen = useCallback(
    (row: AdminLotFulfilmentListRow) => {
      router.push(buildLotFulfilmentDrawerHref(searchParams, row.lotId), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildLotFulfilmentDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <AdminLotFulfilmentBoard
      rows={rows}
      selected={selected}
      onOpen={onOpen}
      onCloseDrawer={onCloseDrawer}
      returnStatus={returnStatus}
      statusChips={statusChips}
      pagination={pagination ?? null}
    />
  );
}
