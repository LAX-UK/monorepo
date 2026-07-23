"use client";

import { ComplianceSofBoard } from "@/components/admin/compliance-sof-board/index";
import type { SofListStatus } from "@/lib/admin/sof-list-query";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";

export type SofBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminSofTableRow[];
  status: SofListStatus;
  canReopen: boolean;
  listReturnTarget?: string | undefined;
  pagination?: SofBoardPagination | null | undefined;
};

export function ComplianceSofBoardContainer({
  rows,
  status,
  canReopen,
  listReturnTarget,
  pagination,
}: Props) {
  return (
    <ComplianceSofBoard
      rows={rows}
      status={status}
      canReopen={canReopen}
      listReturnTarget={listReturnTarget}
      pagination={pagination}
    />
  );
}
