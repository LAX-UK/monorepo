"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SofReopenButton } from "@/components/admin/compliance-sof-board/sof-reopen-button";
import { type SofListStatus, buildSofCaseDetailHref } from "@/lib/admin/sof-list-query";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

type SofColumnOptions = {
  status: SofListStatus;
  canReopen: boolean;
};

function buyerCell(row: AdminSofTableRow) {
  return (
    <div className="min-w-[10rem]">
      <Link
        href={`/admin/clients/${row.userId}`}
        className="text-link underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.buyerLabel}
      </Link>
      {row.pendingCasesForBuyer > 1 ? (
        <span
          className="ml-1 text-xs text-warning"
          title={`${row.pendingCasesForBuyer} pending cases for this buyer`}
        >
          ⚠
        </span>
      ) : null}
    </div>
  );
}

function rejectedActions(row: AdminSofTableRow, canReopen: boolean, listStatus: SofListStatus) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" asChild>
        <Link href={buildSofCaseDetailHref(row.id, listStatus)}>View case</Link>
      </Button>
      {canReopen ? (
        <SofReopenButton caseId={row.id} variant="outline" size="sm">
          Reopen for review
        </SofReopenButton>
      ) : null}
    </div>
  );
}

export function sofColumns({ status, canReopen }: SofColumnOptions): ColumnDef<AdminSofTableRow>[] {
  const columns: ColumnDef<AdminSofTableRow>[] = [
    {
      id: "buyer",
      header: "Buyer",
      cell: ({ row }) => buyerCell(row.original),
    },
    {
      id: "settlement",
      header: "Settlement",
      cell: ({ row }) => (
        <span
          className="max-w-[14rem] truncate text-sm text-on-surface-variant"
          title={row.original.settlementSummary ?? undefined}
        >
          {row.original.settlementSummary ?? "—"}
        </span>
      ),
    },
    {
      id: "trigger",
      header: "Trigger",
      cell: ({ row }) => <span className="font-body text-sm">{row.original.triggerLabel}</span>,
    },
  ];

  if (status === "pending") {
    columns.push({
      id: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="sofCase" status={row.original.displayStatus} />,
    });
  }

  columns.push({
    id: "exposure",
    header: "Exposure",
    cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.exposureLabel}</span>,
  });

  if (status === "pending") {
    columns.push(
      {
        id: "evidence",
        header: "Evidence",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-on-surface">{row.original.evidenceCount}</span>
        ),
      },
      {
        id: "triage",
        header: "Triage",
        cell: ({ row }) => (
          <span className="text-sm text-on-surface">{row.original.triageLabel}</span>
        ),
      },
      {
        id: "opened",
        header: "Opened",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-on-surface-variant">
            {row.original.openedLabel}
          </span>
        ),
      },
      {
        id: "open",
        header: "",
        cell: ({ row }) => (
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link href={buildSofCaseDetailHref(row.original.id, status)}>Review</Link>
          </Button>
        ),
        enableSorting: false,
      },
    );
  } else {
    columns.push({
      id: "reviewed",
      header: "Reviewed",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-on-surface-variant">
          {row.original.reviewedLabel}
        </span>
      ),
    });

    if (status === "rejected") {
      columns.push({
        id: "actions",
        header: "",
        cell: ({ row }) => rejectedActions(row.original, canReopen, status),
        enableSorting: false,
      });
    } else {
      columns.push({
        id: "open",
        header: "",
        cell: ({ row }) => (
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link href={buildSofCaseDetailHref(row.original.id, status)}>View case</Link>
          </Button>
        ),
        enableSorting: false,
      });
    }
  }

  return columns;
}

export function sofTableAriaLabel(status: SofListStatus): string {
  if (status === "pending") return "Source of Funds cases pending review";
  if (status === "rejected") return "Rejected Source of Funds cases";
  return "Approved Source of Funds cases";
}
